// Agent loop with prompt caching, approval gate, tool whitelist, and indicator control.
//
// Caching strategy (Anthropic Messages API):
//   1. System prompt → cache_control on the text block (1 breakpoint)
//   2. Tools list   → cache_control on the LAST tool (1 breakpoint, caches all tools)
//   3. Conversation → cache_control on the last user/assistant message of every prior turn
//      (rolls forward each iteration so the conversation prefix stays cached)
//
// Anthropic allows up to 4 cache_control breakpoints per request. We use the
// 2 static ones (system, tools) plus 1 dynamic one on the most recent
// user-message in the conversation that came BEFORE the latest tool_result —
// which keeps the conversation history hot.

import { streamRich } from './api.js';
import { ALL_TOOLS, executeTool } from './tools.js';
import { memoryAdapter } from './memory.js';
import { kbAdapter } from './kb.js';
import { tracesAdapter } from './traces.js';

const SYSTEM_PROMPT_AGENT = `You are MoonBridge, a powerful browser automation agent in a Chrome extension. You can read and control any tab in the user's browser.

# Your superpowers
- **Read pages**: get_page (active tab), read_tab (any tab without switching), find_element (search by text), extract_links, get_console.
- **Interact**: click (incl. right/middle), hover, type, key_press (e.g. "Control+a"), select_option, fill_form (multi-field, optional submit), scroll (incl. into_view).
- **Page-level**: wait_for (poll for selector), wait, navigate, back, forward, reload, screenshot, execute_js (arbitrary JS, returns JSON).
- **Multi-tab**: list_tabs (incl. all windows), switch_tab, new_tab, close_tab, duplicate_tab. Most interactive tools accept an optional tab_id so you can act on a tab WITHOUT switching to it.

# Strategy
1. Start with get_page (or read_tab if user asks about a specific other tab) to see what's available.
2. Prefer DOM tools with #ref-N selectors over screenshot — faster, cheaper, more reliable.
3. Use screenshot ONLY for visual layout, images, canvas, or when DOM is insufficient.
4. After clicks/navigation, use wait_for (preferred) or get_page to confirm the new state.
5. For multi-tab tasks, use read_tab to inspect tabs in parallel without losing the active tab.
6. For complex tasks, plan briefly in 1-2 sentences, then execute. Don't ask permission to use tools — just use them.
7. Restricted pages (chrome://, file://, etc.) cannot be controlled — explain and suggest navigating elsewhere.
8. When done, give a concise summary of what you did. Don't over-explain.

# Tab strategy (CRITICAL — preserve user context)
- The user is currently reading a tab. Do NOT replace its content unless they ask.
- When the user wants to open a different site/page, ALWAYS use \`new_tab\` (with the URL) — NEVER \`navigate\` on the current tab.
- After opening a new tab, read it with \`read_tab tab_id=...\` WITHOUT switching to it. The user keeps their original tab visible.
- For multi-source research, open multiple tabs in background (\`new_tab background=true\`) and call \`read_tab\` on each in parallel.
- Use \`navigate\` ONLY when the user explicitly says: "go to X here", "open X on this tab", "replace this page", or you're already in a flow on a tab the user opened for that purpose.

# Style
- Be efficient. Minimize tool calls. Use fill_form for multi-field forms instead of N type() calls.
- Use parallel tool calls when actions are independent (e.g. read 3 tabs at once).
- Never repeat the same tool with the same input twice in a row — change strategy if it fails.`;

export const AGENT_DEFAULT_SYSTEM = SYSTEM_PROMPT_AGENT;

function filterTools(whitelist) {
  if (!whitelist || whitelist.size === 0) return ALL_TOOLS;
  return ALL_TOOLS.filter((t) => whitelist.has(t.name));
}

function tagToolsForCaching(tools, enableCaching, ttl = '5m') {
  if (!enableCaching || !tools.length) return tools;
  return tools.map((t, i, arr) => {
    if (i === arr.length - 1) return { ...t, cache_control: { type: 'ephemeral', ttl } };
    return t;
  });
}

// Add cache_control to last message of conversation for rolling cache.
function withConversationCache(conversation, enable, ttl = '5m') {
  if (!enable || conversation.length === 0) return conversation;
  const out = conversation.slice(0);
  const lastIdx = out.length - 1;
  const last = out[lastIdx];
  const cloned = { ...last };
  if (typeof cloned.content === 'string') {
    cloned.content = [{ type: 'text', text: cloned.content, cache_control: { type: 'ephemeral', ttl } }];
  } else if (Array.isArray(cloned.content) && cloned.content.length) {
    cloned.content = cloned.content.map((b, i) => {
      if (i !== cloned.content.length - 1) return b;
      return { ...b, cache_control: { type: 'ephemeral', ttl } };
    });
  }
  out[lastIdx] = cloned;
  return out;
}

export async function* runAgent({
  baseUrl,
  apiToken,
  model,
  system,
  conversation,
  temperature,
  maxTokens,
  toolWhitelist,
  approvalMode,
  askApproval,
  enableCaching = true,
  cacheTtl = '5m',
  traceId = null,            // optional trace id for auto-recording
  attachments = null,        // raw user-attached files (last user message) for chat-attachment tools
  signal,
}) {
  const userSys = (system && system.trim()) ? system.trim() + '\n\n' : '';
  // Auto-inject persistent memories
  const memSection = await memoryAdapter.renderForSystem();
  const memText = memSection ? memSection + '\n\n' : '';
  const sysText = memText + userSys + SYSTEM_PROMPT_AGENT;
  const cc = enableCaching ? { type: 'ephemeral', ttl: cacheTtl } : null;
  const systemBlocks = enableCaching
    ? [{ type: 'text', text: sysText, cache_control: cc }]
    : sysText;

  const tools = tagToolsForCaching(filterTools(toolWhitelist), enableCaching, cacheTtl);

  // Adapter context for memory/kb tools
  const adapterCtx = { memory: memoryAdapter, kb: kbAdapter, attachments, conversation };

  // Unlimited iterations. Loop runs until:
  //  - stop_reason !== 'tool_use'  (task complete)
  //  - signal aborted               (user clicked Stop)
  //  - API error                    (yielded as 'error' event)
  for (let iter = 1; ; iter++) {
    if (signal?.aborted) { yield { kind: 'error', message: 'Aborted by user.' }; return; }
    yield { kind: 'iteration', n: iter };

    const blocks = new Map();
    let stopReason = null;
    let usage = null;
    let streamErrored = false;

    // Send conversation with cache breakpoint on the last message
    const cachedConv = withConversationCache(conversation, enableCaching && conversation.length > 0, cacheTtl);

    for await (const ev of streamRich({
      baseUrl, apiToken, model,
      system: systemBlocks,
      messages: cachedConv,
      tools,
      temperature, maxTokens, signal,
    })) {
      if (ev.type === 'error') { yield { kind: 'error', message: ev.data }; streamErrored = true; break; }
      if (ev.type === 'done') break;

      if (ev.type === 'block_open') {
        if (ev.block.type === 'text') blocks.set(ev.index, { type: 'text', text: '' });
        else if (ev.block.type === 'thinking') blocks.set(ev.index, { type: 'thinking', thinking: '' });
        else if (ev.block.type === 'tool_use') {
          blocks.set(ev.index, { type: 'tool_use', id: ev.block.id, name: ev.block.name, partial: '' });
          yield { kind: 'tool_call_start', id: ev.block.id, name: ev.block.name, index: ev.index };
        }
      } else if (ev.type === 'text') {
        const b = blocks.get(ev.index); if (b) b.text += ev.data;
        yield { kind: 'text_delta', index: ev.index, text: ev.data };
      } else if (ev.type === 'thinking') {
        const b = blocks.get(ev.index); if (b) b.thinking += ev.data;
        yield { kind: 'thinking_delta', index: ev.index, text: ev.data };
      } else if (ev.type === 'tool_input') {
        const b = blocks.get(ev.index); if (b) b.partial += ev.data;
        yield { kind: 'tool_input_delta', index: ev.index, partial: ev.data };
      } else if (ev.type === 'block_close') {
        const b = blocks.get(ev.index);
        if (b?.type === 'tool_use') {
          let parsed = {};
          try { parsed = b.partial ? JSON.parse(b.partial) : {}; } catch { parsed = {}; }
          b.input = parsed;
          delete b.partial;
          yield { kind: 'tool_call_complete', id: b.id, name: b.name, input: parsed, index: ev.index };
        }
      } else if (ev.type === 'usage') { usage = ev.data; yield { kind: 'usage', data: ev.data }; }
      else if (ev.type === 'stop_reason') { stopReason = ev.data; }
    }
    if (streamErrored) return;

    const orderedIndexes = [...blocks.keys()].sort((a, b) => a - b);
    const assistantContent = [];
    for (const i of orderedIndexes) {
      const b = blocks.get(i);
      if (b.type === 'text' && b.text) assistantContent.push({ type: 'text', text: b.text });
      else if (b.type === 'tool_use') assistantContent.push({ type: 'tool_use', id: b.id, name: b.name, input: b.input || {} });
    }
    if (assistantContent.length === 0) {
      yield { kind: 'turn_end', stop_reason: stopReason || 'empty' };
      return;
    }
    conversation.push({ role: 'assistant', content: assistantContent });

    yield { kind: 'turn_end', stop_reason: stopReason };
    if (stopReason !== 'tool_use') return;

    const toolResultBlocks = [];

    // ====== PARALLEL TOOL EXECUTION ======
    // Read-only / side-effect-free tools → run with Promise.all (huge speedup
    // when model batches multiple read_tab/get_page/web_search/etc).
    // Mutating tools (click, type, navigate, etc) run sequentially.
    const READ_ONLY_TOOLS = new Set([
      'get_page', 'read_tab', 'find_element', 'extract_links', 'get_console',
      'list_tabs', 'screenshot', 'web_search', 'youtube_transcript', 'read_pdf',
      'fetch_url', 'recall_memories', 'list_kb', 'search_kb',
    ]);
    const toolUseBlocks = orderedIndexes.map((i) => blocks.get(i)).filter((b) => b.type === 'tool_use');
    const allReadOnly = toolUseBlocks.length > 1 && toolUseBlocks.every((b) => READ_ONLY_TOOLS.has(b.name));

    async function runOne(b) {
      if (signal?.aborted) {
        return { id: b.id, name: b.name, content: 'Aborted by user.', isError: true };
      }
      const t0 = Date.now();
      let result;
      try { result = await executeTool(b.name, b.input || {}, { whitelist: toolWhitelist, approvalMode, askApproval, ...adapterCtx }); }
      catch (e) { result = { is_error: true, content: `Executor crashed: ${e.message}` }; }
      const dataUrl = result?._dataUrl;
      if (result && '_dataUrl' in result) delete result._dataUrl;
      const out = { id: b.id, name: b.name, content: result.content, isError: !!result.is_error, dataUrl };

      // Debug log: track REAL tool result from executor
      const previewText = typeof result.content === 'string'
        ? result.content
        : Array.isArray(result.content) ? result.content.map((c) => c.type === 'text' ? c.text : `[${c.type}]`).join(' ') : JSON.stringify(result.content);
      console.log(`[agent.runOne] tool=${b.name}`, {
        durationMs: Date.now() - t0,
        isError: !!result.is_error,
        contentBytes: (previewText || '').length,
        preview: (previewText || '').slice(0, 200),
      });

      if (traceId) {
        tracesAdapter.addStep(traceId, {
          name: b.name,
          input: b.input || {},
          content: result.content,
          isError: !!result.is_error,
          dataUrl,
          durationMs: Date.now() - t0,
        }).catch(() => {});
      }
      return out;
    }

    let results;
    if (allReadOnly) {
      // Parallel
      results = await Promise.all(toolUseBlocks.map((b) => runOne(b)));
    } else {
      // Sequential (mutating tools may depend on order/page state)
      results = [];
      for (const b of toolUseBlocks) results.push(await runOne(b));
    }

    for (const r of results) {
      yield { kind: 'tool_result', id: r.id, name: r.name, content: r.content, isError: r.isError, dataUrl: r.dataUrl };
      const block = { type: 'tool_result', tool_use_id: r.id, content: r.content };
      if (r.isError) block.is_error = true;
      toolResultBlocks.push(block);
    }
    conversation.push({ role: 'user', content: toolResultBlocks });
  }
}
