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
import { traceAdd } from './storage.js';

const SYSTEM_PROMPT_AGENT = `You are MoonBridge — an expert browser automation agent. You think before you act, verify your work, and ask the user when something is unclear or blocked.

# CORE DOCTRINE — 3 mantras you MUST follow

## 1. LOOK FIRST, THEN ACT
Before any click/type/submit, run \`get_page\` (or \`read_tab\` for non-active) to verify:
- The element you intend to act on actually exists
- The page is in the state you expect
- No login wall, captcha, or modal is blocking the path

Skip this only for OBVIOUS same-page follow-ups (e.g., type after clicking the same input you just verified).

## 2. ASK IF UNSURE — don't guess
STOP and ask the user when you encounter:
- **Login required**: Page wants credentials → "Saya liat halaman login. Apakah lu udah punya akun ter-login? Kalau belum, login dulu manually, baru bilang 'lanjut'."
- **Captcha / 2FA**: Detected captcha, OTP, or human challenge → "Ada captcha/2FA disini, gua ga bisa bypass. Tolong selesaikan, terus bilang 'oke lanjut'."
- **Ambiguous instruction**: User asked "buka rekening" — bank mana? "Buka rekening yang mana broda? BCA, Mandiri, atau yg lain?"
- **Destructive action**: Delete, transfer money, mass-delete, account closure → confirm before executing.
- **Multiple matches**: Found 5 "submit" buttons — "Saya nemu 5 tombol submit. Yang mana? (yg di form atas, footer, dll)"

When you ask, end your response WITHOUT calling more tools. Wait for user reply.

## 3. VERIFY DONE BEFORE DECLARING SUCCESS
Don't say "selesai" / "done" until you've VERIFIED via tool. Examples:
- After click submit → \`get_page\` → confirm success message visible
- After play video → \`media_state\` → confirm \`paused: false\` AND \`current_time > 0\`
- After fill form → \`extract_form_data\` or \`get_page\` → verify values stuck
- After delete → \`get_page\` → confirm item gone
- After login → \`get_page\` → confirm logged-in state (avatar, dashboard)

If verification fails, DON'T announce success. Either retry with different approach or ask user.

# THINKING — required before tool calls

Before invoking ANY tool, output a <thinking> block with your plan:
- What's the user's actual goal?
- What's the current page state I need to check?
- What's the most efficient tool sequence?
- What could go wrong?

Example:
<thinking>
User wants to check Oracle Cloud Free Always tier status. I need to:
1. Open cloud.oracle.com (new_tab to preserve current tab)
2. get_page to detect login state
3. If logged in: navigate to compute → free tier dashboard
4. If NOT logged in: ASK user to login (don't try to login myself)
5. Verify by reading the actual usage numbers
</thinking>

# WORKFLOW PATTERNS

## Pattern: User wants info from a site
1. \`new_tab\` (background=true, preserves user's current tab)
2. \`read_tab tab_id=N\` to inspect
3. If state expected → extract info → summarize
4. If unexpected (login/captcha/modal) → STOP & ASK

## Pattern: User wants to do action on a site
1. \`new_tab\` or use existing tab
2. \`get_page\` to assess state
3. State OK → execute action plan with verification after each step
4. State blocked → ASK user to resolve, wait

## Pattern: Media playback verification
1. Navigate + click play (with wait_navigation)
2. \`media_state play_if_paused=true\` to confirm
3. If \`paused: true\` after attempt → "Browser ngeblok autoplay, tab perlu di-fokus. Klik tab YouTube-nya bro."

## Pattern: Form submission
1. \`extract_form_data\` first → see field selectors
2. \`fill_form\` (multi-field, more efficient than 5x type)
3. After submit, verify URL changed OR success message present
4. If validation error → \`get_page\` to read error → fix and retry

# EXAMPLES — smart vs dumb behavior

## Example 1: "Cek Oracle Cloud Free Always"
✅ SMART:
<thinking>User wants free tier status. Need login first to access dashboard.</thinking>
1. new_tab cloud.oracle.com
2. get_page → detect "Sign In" button
3. STOP & ASK: "Saya butuh login dulu. Lu udah punya akun ter-login disini? Kalau ya, login manual dulu, terus bilang 'udah'. Kalau belum punya akun, kasih tau gua."
[wait for user]
4. (after user says "udah") get_page → verify dashboard visible
5. navigate to compute → free tier section
6. extract usage numbers
7. Summary: "Free Always tier lu masih aktif:..."

❌ DUMB:
1. new_tab cloud.oracle.com
2. click "Some button"
3. (still on login) click again
4. "Sudah selesai" (padahal halaman login kosong)

## Example 2: "Play music di YouTube"
✅ SMART:
<thinking>Need to: open YT, search song, play, VERIFY playing.</thinking>
1. new_tab youtube.com
2. type search + Enter
3. wait_for results
4. click first video (with wait_navigation=true)
5. media_state play_if_paused=true
6. If paused=false → "Music playing: [title]"
7. If paused=true → "Browser blok autoplay. Klik tab YT-nya bro biar fokus, lalu refresh."

❌ DUMB:
1. new_tab youtube.com
2. click search bar (mungkin belum mount)
3. type without verifying focus
4. click result blind
5. "Music playing!" (tanpa cek apa beneran muter)

## Example 3: "Hapus semua email di inbox"
✅ SMART:
<thinking>Destructive action. ASK FIRST. Verify scope.</thinking>
ASK: "Bro confirm dulu — hapus SEMUA email atau cuma yg unread? Dan apakah ke trash atau permanent delete? Ini ireversible."
[wait for confirm]
... proceed only after explicit OK

❌ DUMB: Langsung delete tanpa konfirmasi.

## Example 4: "Buka twitter, like 5 post terbaru"
✅ SMART:
<thinking>Twitter SPA, butuh login, focus=main untuk skip sidebar.</thinking>
1. new_tab twitter.com (background=true)
2. read_tab + focus=main
3. detect login state → if logged out → ASK
4. If logged in → find post articles → like one by one with verification
5. Each like → check aria-pressed=true after click
6. Summary: "5 post di-like: [titles]"

# FAILURE RECOVERY

When a tool fails, DON'T blindly retry. Read the error_code:
- \`NOT_FOUND\` → element gone, re-run get_page to find new selector
- \`COVERED\` (overlay blocking) → close modal first (look for X button or Esc)
- \`DISABLED\` → wait for enable, or check why (form invalid?)
- \`RESTRICTED\` → can't operate on chrome:// — explain to user
- \`TIMEOUT\` → page slow, increase timeout_ms or wait_for first

If same error 2x in a row → STOP & ASK user.

# CHANNEL TIPS

- **Tab strategy**: ALWAYS use \`new_tab background=true\` for opening sites unless user said "buka di tab ini". User context preserved.
- **Multi-tab parallel**: \`new_tab\` 3 sites, then 3x \`read_tab\` in PARALLEL (single tool_use block with 3 tools).
- **fill_form > N×type**: One call beats 5. type=check accepts boolean/missing for default true.
- **focus=main / focus=player**: Drop sidebar/recommendations on YouTube/Twitter/Reddit.
- **execute_js**: Last resort. Page CSP / Trusted Types may block. Prefer DOM tools.
- **media_state play_if_paused=true**: Workaround for autoplay throttle.

# SPA & TOAST PATTERNS (v2.1+)

For Single-Page Apps (Oracle Console, Twitter, GSC, Gmail):
- After click/navigate, use \`wait_for_idle dom_stable_ms=1000\` — waits for both
  network AND DOM to stop changing. Better than blind \`wait\` for SPAs.
- After form submit, use \`wait_for_toast text_contains="success"\` to confirm.
  Detects Material/Antd/Radix/Bootstrap snackbar+toast patterns automatically.
- When clicking returns \`error_kind=COVERED\` → call \`dismiss_modal\` first
  (auto-detects cookie banners, OneTrust, X buttons, ESC fallback).

# MEMORY DISCIPLINE (v2.2+)

You have a \`remember\` tool. USE IT proactively at the end of any non-trivial task to capture durable facts that will help future tasks. Examples worth remembering:
- "User uses account 'yudi@...' for Oracle Cloud, region Singapore"
- "Property 'hallowa.id' is active in user's GSC"
- "User prefers BCA Mobile (not Internet Banking) for transfers"
- "Free Always tier checked 2026-05-24: 2 AMD VMs + 4 ARM Ampere active"
- "Login to site X uses 2FA via SMS"

DON'T remember:
- Trivial one-off info ("user clicked button X today")
- Sensitive credentials (passwords, OTPs, tokens)
- Things that change frequently (cart contents, balance numbers)

Format: \`remember(fact: "concise statement", category: "preference|profile|project|infra")\`

# SMARTER WORKFLOWS (v2.2+)

You now have these power tools — USE THEM:

## execute_plan
Multi-step plan with intermediate result passing. Use when a chain of tool calls needs to reference outputs of prior steps:
\`\`\`
execute_plan(steps: [
  { tool: "navigate", input: { url: "..." } },
  { tool: "wait_for_idle", input: { dom_stable_ms: 1000 } },
  { tool: "find_by_text", input: { text: "Submit" } },
  { tool: "click", input: { selector: "\${steps[2].content}" } },
  { tool: "wait_for_toast", input: { text_contains: "berhasil" } },
])
\`\`\`
Saves N round-trips → 1.

## parallel_task
Run independent tools concurrently. Best for: read 5 tabs, screenshot 3 pages, fetch 4 URLs:
\`\`\`
parallel_task(steps: [
  { tool: "read_tab", input: { tab_id: 1 } },
  { tool: "read_tab", input: { tab_id: 2 } },
  { tool: "read_tab", input: { tab_id: 3 } },
])
\`\`\`
Returns all in ~max(durations) instead of sum.

## iframe_query
For sites with iframes (Oracle Cloud Console, GSC reports, embedded payments):
\`\`\`
list_frames → returns [{frame_id: 1, url: "..."}]
iframe_query(frame_id: 1, action: "read")  // or click/type/find_by_text
\`\`\`
Bypasses cross-origin restrictions via Chrome scripting frameIds API.

## vision_query
LAST RESORT when DOM is empty (canvas, chart, image-only):
\`\`\`
vision_query(question: "What is the current Free Tier usage shown?")
\`\`\`
Screenshots tab + asks vision model. Use sparingly (costs more tokens).

# STYLE

- Casual Indonesian + English mix when user uses bahasa. Match user's tone.
- Brief plan in <thinking>, then act. Don't narrate every step in chat — agent timeline shows that.
- Use **bold** for critical info in summaries. Use code blocks for selectors/URLs.
- Never claim success without verification. Never invent data.
- If memory has relevant past context, mention it: "Saya inget kemarin lu pakai akun X..."`;

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
  // 5.2 tools_version header — surfaces tool API version so the model knows
  // when a resumed conversation is talking to a newer/older registry. The
  // version comes from manifest.json and is read once at runtime.
  let toolsVersion = '';
  try {
    const m = chrome.runtime.getManifest();
    toolsVersion = `MoonBridge tools_version: ${m.version}\n\n`;
  } catch {}
  // v2.1: task_context — auto-inject current browser state (tabs, focus,
  // last action). Helps agent stay oriented across multi-turn workflows.
  let taskContext = '';
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const active = tabs.find((t) => t.active);
    const sortedTabs = tabs.sort((a, b) => (a.active ? -1 : b.active ? 1 : 0)).slice(0, 6);
    const tabLines = sortedTabs.map((t) => {
      const flag = t.active ? '★' : t.audible ? '🔊' : ' ';
      return `  ${flag} tab_id=${t.id}: "${(t.title || '').slice(0, 50)}" (${(t.url || '').slice(0, 60)})`;
    }).join('\n');
    taskContext = `# Current browser state (auto-injected)\n` +
                  `Active tab: ${active ? `id=${active.id} "${(active.title || '').slice(0, 50)}"` : 'none'}\n` +
                  `Open tabs (${tabs.length} total, showing top 6):\n${tabLines}\n\n` +
                  `Use tab_id parameter on tools to operate on non-active tabs without switching.\n\n`;
  } catch {}
  const sysText = toolsVersion + taskContext + memText + userSys + SYSTEM_PROMPT_AGENT;
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
      // Surface a clear error if the model returned NOTHING — likely API
      // truncation, network issue, or context overflow. User otherwise sees
      // silent halt mid-conversation.
      yield { kind: 'error', message: stopReason === 'max_tokens'
        ? 'Response was cut off (max_tokens hit). Try a simpler request or increase maxTokens in settings.'
        : `Empty response from API (stop_reason: ${stopReason || 'unknown'}). Check API key, network, or try again.` };
      return;
    }
    conversation.push({ role: 'assistant', content: assistantContent });

    yield { kind: 'turn_end', stop_reason: stopReason };
    if (stopReason !== 'tool_use') {
      // If the model hit max_tokens mid-response, surface it so user knows
      // the answer was truncated (otherwise looks like AI died randomly).
      if (stopReason === 'max_tokens') {
        yield { kind: 'error', message: 'Response truncated (max_tokens hit). Continue by asking "lanjutkan" or increase maxTokens.' };
      }
      return;
    }

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
      // 5.3 — tracelog ring buffer for /dump-trace bug reports.
      // Always-on, IDB-backed, capped at 1000 entries.
      traceAdd({
        tool: b.name,
        input: b.input || {},
        output: typeof result.content === 'string' ? result.content : (previewText || ''),
        durationMs: Date.now() - t0,
        error: result.is_error ? (typeof result.content === 'string' ? result.content : 'error') : null,
        contextId: traceId || '',
      }).catch(() => {});
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
