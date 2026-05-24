import { streamMessages, listModels } from './lib/api.js';
import { renderMarkdown } from './lib/markdown.js';
import { runAgent } from './lib/agent.js';
import { ALL_TOOLS } from './lib/tools.js';
import { readFile, buildUserContent, kindIcon } from './lib/files.js';
import { memoryAdapter } from './lib/memory.js';
import { kbAdapter } from './lib/kb.js';
import { promptsAdapter } from './lib/prompts.js';
import { scheduledAdapter } from './lib/scheduled.js';
import { tracesAdapter } from './lib/traces.js';
import { mcpClient } from './lib/mcp-client.js';
import {
  logger, debounce, rafThrottle, jsonSize, fmtBytes,
  sanitizeChat, sanitizeConversation,
  safeStorageSet, reportStorageUsage, pruneOldBlobs,
} from './lib/storage.js';

const $ = (id) => document.getElementById(id);

// --- DOM refs ---
const messagesEl = $('messages');
const inputEl = $('input');
const sendBtn = $('sendBtn');
const stopBtn = $('stopBtn');
const newChatBtn = $('newChatBtn');
const historyBtn = $('historyBtn');
const overflowBtn = $('overflowBtn');
const overflowMenu = $('overflowMenu');
const modelSelect = $('modelSelect');
const speedSelect = $('speedSelect');
const cliBtn = $('cliBtn');
const modeChatBtn = $('modeChat');
const modeAgentBtn = $('modeAgent');
const hintEl = $('hint');
const recBadge = $('recBadge');

// History
const historyPanel = $('historyPanel');
const historyClose = $('historyClose');
const historySearch = $('historySearch');
const historyList = $('historyList');

// Overflow items
const ovTools = $('ovTools');
const ovRec = $('ovRec');
const ovExport = $('ovExport');
const ovDelete = $('ovDelete');
const ovSettings = $('ovSettings');

// Drawers
const toolsDrawer = $('toolsDrawer');
const toolsList = $('toolsList');
const toolsAllBtn = $('toolsAll');
const toolsNoneBtn = $('toolsNone');
const toolsCloseBtn = $('toolsClose');
const approvalModeSel = $('approvalMode');
const recDrawer = $('recDrawer');
const recList = $('recList');
const recRecord = $('recRecord');
const recCloseBtn = $('recClose');

// Approval modal
const approvalBackdrop = $('approvalBackdrop');
const approvalReason = $('approvalReason');
const approvalDetails = $('approvalDetails');
const approvalAllow = $('approvalAllow');
const approvalDeny = $('approvalDeny');

// Attachments
const attachBtn = $('attachBtn');
const fileInput = $('fileInput');
const attachmentRow = $('attachmentRow');
const dropOverlay = $('dropOverlay');
const slashPop = $('slashPop');
const jumpPill = $('jumpPill');

// Library
const libDrawer = $('libDrawer');
const libClose = $('libClose');
const libBody = $('libBody');
const libTabs = document.querySelectorAll('.lib-tab');
const ovLib = $('ovLib');
let libTab = 'memory';

// --- State ---
let settings = null;
let mode = 'chat';
let conversation = [];
let abortCtrl = null;
let toolWhitelist = new Set(ALL_TOOLS.map((t) => t.name));
let approvalModeVal = 'destructive';
let recordingActive = false;
let recordedSteps = [];
let savedRecordings = [];

// Conversation persistence
let currentChatId = null;
let savedChats = []; // [{id, title, mode, model, conversation, updatedAt}]

// Pending attachments for next send
let pendingAttachments = []; // [{id, name, mime, size, kind, dataUrl?, text?, base64?}]
// Most recent SENT attachments — accessible to agent tools (list_chat_attachments / get_chat_attachment / upload_image)
let lastSentAttachments = [];

// =====================================================================
// EXAMPLE PROMPTS
// =====================================================================

const EXAMPLES_CHAT = [
  { e: '✨', t: 'Explain a programming concept' },
  { e: '📝', t: 'Help me draft an email' },
  { e: '🧮', t: 'Solve a math problem step by step' },
  { e: '💡', t: 'Brainstorm ideas for a project' },
];
const EXAMPLES_AGENT = [
  { e: '📰', t: 'Read the top 5 stories on Hacker News and summarize' },
  { e: '🔍', t: 'Search Google for "best mechanical keyboards 2026" and list the top 3' },
  { e: '🗂', t: 'Tell me what tabs I have open and what each one is about' },
  { e: '📄', t: 'Summarize this page in 3 bullets' },
];

// =====================================================================
// Storage
// =====================================================================

async function loadSettings() {
  const data = await chrome.storage.local.get(['settings', 'agentPrefs', 'recordings', 'chats']);
  settings = data.settings || {
    baseUrl: 'https://rck8ncp.abc-tunnel.us/v1',
    apiToken: '',
    defaultModel: 'kr/claude-sonnet-4.5',
    systemPrompt: '',
    temperature: 1.0,
    maxTokens: 4096,
    cacheTtl: '5m',
  };
  if (!settings.cacheTtl) settings.cacheTtl = '5m';
  if (data.agentPrefs) {
    if (Array.isArray(data.agentPrefs.toolWhitelist)) {
      // Restore stored whitelist BUT auto-enable any tool that's been added
      // to ALL_TOOLS since last save. Without this, new tools (smart_click,
      // ai_extract_data, db_*, etc) get silently filtered out because the
      // stored whitelist was captured when the tool list was smaller.
      const stored = new Set(data.agentPrefs.toolWhitelist);
      const currentNames = ALL_TOOLS.map((t) => t.name);
      const newTools = currentNames.filter((n) => !stored.has(n));
      if (newTools.length) {
        for (const n of newTools) stored.add(n);
        // Persist immediately so next reload sees the merged set
        await safeStorageSet({
          agentPrefs: { ...data.agentPrefs, toolWhitelist: [...stored] },
        });
        logger.info(`auto-enabled ${newTools.length} new tools added since last session.`);
      }
      toolWhitelist = stored;
    }
    if (data.agentPrefs.approvalMode) approvalModeVal = data.agentPrefs.approvalMode;
  }
  approvalModeSel.value = approvalModeVal;
  savedRecordings = data.recordings || [];
  savedChats = data.chats || [];

  // Storage diagnostics on boot
  reportStorageUsage().catch(() => {});
  // Drop blobs older than a week (one-shot)
  pruneOldBlobs().catch(() => {});
}

async function saveAgentPrefs() {
  await safeStorageSet({
    agentPrefs: { toolWhitelist: [...toolWhitelist], approvalMode: approvalModeVal },
  });
}
async function saveRecordings() {
  await safeStorageSet({ recordings: savedRecordings });
}

// ---------- Chat persistence (debounced + sanitized + quota-safe) ----------
const MAX_SAVED_CHATS = 20;
const MAX_MSGS_PER_CHAT = 30;

async function persistChats() {
  await safeStorageSet({ chats: savedChats }, {
    onTrim: (n) => logger.warn(`auto-trimmed ${n} oldest chats due to quota pressure`),
  });
}

// Debounced version — coalesces noisy in-stream saves to one write per 800ms.
const _debouncedSaveCurrent = debounce(_saveCurrentChatNow, 800);

function scheduleChatSave() {
  // Fire-and-forget; the debounced fn handles its own promise.
  _debouncedSaveCurrent();
}

async function saveCurrentChat() {
  // Public API: bypass debounce when caller explicitly awaits a save.
  return _debouncedSaveCurrent.flush();
}

async function _saveCurrentChatNow() {
  if (!conversation.length) return;
  const now = Date.now();
  if (!currentChatId) currentChatId = 'chat_' + now + '_' + Math.random().toString(36).slice(2, 8);

  // Preserve user-edited title — saveCurrentChat regenerates from first user
  // message every save, which used to overwrite any rename on next chat send.
  const existing = savedChats.find((c) => c.id === currentChatId);
  let title;
  if (existing?.titleEdited) {
    title = existing.title;
  } else {
    const first = conversation.find((m) => m.role === 'user');
    if (first) {
      const text = typeof first.content === 'string'
        ? first.content
        : (Array.isArray(first.content) ? first.content.find((c) => c.type === 'text')?.text || '' : '');
      title = text.slice(0, 60).trim() || 'Untitled';
    } else {
      title = 'Untitled';
    }
  }
  // Sanitize: strip image/document base64, trim long text, cap message count.
  const entry = sanitizeChat({
    id: currentChatId,
    title,
    titleEdited: !!existing?.titleEdited,
    mode,
    model: modelSelect.value || settings.defaultModel,
    conversation,
    updatedAt: now,
  }, { maxMessages: MAX_MSGS_PER_CHAT });

  const idx = savedChats.findIndex((c) => c.id === currentChatId);
  if (idx >= 0) savedChats[idx] = entry;
  else savedChats.unshift(entry);
  // Cap saved chats hard.
  if (savedChats.length > MAX_SAVED_CHATS) savedChats = savedChats.slice(0, MAX_SAVED_CHATS);
  await persistChats();
  if (!historyPanel.classList.contains('hidden')) renderHistory();
}

// =====================================================================
// Models
// =====================================================================

async function loadModelList() {
  modelSelect.replaceChildren();
  if (!settings.apiToken) {
    addOption(modelSelect, settings.defaultModel || 'kr/claude-sonnet-4.5', true);
    return;
  }
  try {
    const models = await listModels({ baseUrl: settings.baseUrl, apiToken: settings.apiToken });
    if (!models.length) { addOption(modelSelect, settings.defaultModel, true); return; }
    for (const m of models) addOption(modelSelect, m, m === settings.defaultModel);
    if (!models.includes(settings.defaultModel) && settings.defaultModel) {
      const opt = document.createElement('option');
      opt.value = settings.defaultModel;
      opt.textContent = settings.defaultModel + ' (custom)';
      opt.selected = true;
      modelSelect.prepend(opt);
    }
  } catch (e) {
    addOption(modelSelect, settings.defaultModel || 'kr/claude-sonnet-4.5', true);
    setHint(`Could not load models: ${e.message}`);
  }
}

function addOption(sel, value, selected) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = value;
  if (selected) opt.selected = true;
  sel.appendChild(opt);
}

// =====================================================================
// History panel
// =====================================================================

function openHistory() {
  historyPanel.classList.remove('hidden');
  historyBtn.classList.add('active');
  renderHistory();
}
function closeHistory() {
  historyPanel.classList.add('hidden');
  historyBtn.classList.remove('active');
}

function renderHistory(filter = '') {
  historyList.replaceChildren();
  const q = filter.trim().toLowerCase();
  const items = q ? savedChats.filter((c) => (c.title || '').toLowerCase().includes(q)) : savedChats;
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = q ? 'No matches.' : 'No saved chats yet.';
    historyList.appendChild(empty);
    return;
  }
  // Group by date bucket
  const buckets = { today: [], yesterday: [], week: [], older: [] };
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400_000;
  const sevenDaysAgo = startOfToday - 7 * 86400_000;
  for (const c of items) {
    const t = c.updatedAt || 0;
    if (t >= startOfToday) buckets.today.push(c);
    else if (t >= startOfYesterday) buckets.yesterday.push(c);
    else if (t >= sevenDaysAgo) buckets.week.push(c);
    else buckets.older.push(c);
  }
  const groups = [
    { label: 'Today', list: buckets.today },
    { label: 'Yesterday', list: buckets.yesterday },
    { label: 'Previous 7 days', list: buckets.week },
    { label: 'Older', list: buckets.older },
  ];
  for (const g of groups) {
    if (!g.list.length) continue;
    const lab = document.createElement('div');
    lab.className = 'history-group-label';
    lab.textContent = g.label;
    historyList.appendChild(lab);
    for (const c of g.list) {
      const row = document.createElement('div');
      row.className = 'history-item' + (c.id === currentChatId ? ' active' : '');
      const title = document.createElement('div');
      title.className = 'history-item-title';
      if (c.mode === 'agent') {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'Agent';
        title.appendChild(badge);
      }
      const span = document.createElement('span');
      span.className = 'history-item-text';
      span.textContent = c.title || 'Untitled';
      title.appendChild(span);
      const meta = document.createElement('div');
      meta.className = 'history-item-meta';
      meta.innerHTML = `<span>${formatDate(c.updatedAt)}</span><span>${countTurns(c.conversation)} turns</span>`;

      // Inline rename + delete actions (hover to reveal)
      const actions = document.createElement('div');
      actions.className = 'history-item-actions';
      const renameBtn = document.createElement('button');
      renameBtn.className = 'history-item-action';
      renameBtn.title = 'Rename';
      renameBtn.textContent = '✎';
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startRenameChat(c, span);
      });
      const delBtn = document.createElement('button');
      delBtn.className = 'history-item-action danger';
      delBtn.title = 'Delete';
      delBtn.textContent = '🗑';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteHistoryChat(c);
      });
      actions.appendChild(renameBtn);
      actions.appendChild(delBtn);

      row.appendChild(title);
      row.appendChild(meta);
      row.appendChild(actions);
      row.addEventListener('click', () => loadChat(c));
      historyList.appendChild(row);
    }
  }
}

async function deleteHistoryChat(chat) {
  if (!chat?.id) return;
  if (!confirm(`Delete "${chat.title || 'Untitled'}"?\nThis can't be undone.`)) return;
  savedChats = savedChats.filter((c) => c.id !== chat.id);
  if (currentChatId === chat.id) {
    currentChatId = null;
    conversation = [];
    renderConversation();
  }
  await persistChats();
  renderHistory(historySearch.value || '');
}

function startRenameChat(chat, labelEl) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'history-rename-input';
  input.value = chat.title || '';
  input.maxLength = 80;
  labelEl.replaceWith(input);
  input.focus();
  input.select();

  const finish = async (commit) => {
    const newTitle = input.value.trim();
    if (commit && newTitle && newTitle !== chat.title) {
      chat.title = newTitle;
      chat.titleEdited = true;  // sticky flag — saveCurrentChat won't overwrite
      chat.updatedAt = Date.now();
      const idx = savedChats.findIndex((x) => x.id === chat.id);
      if (idx >= 0) {
        savedChats[idx] = chat;
        await persistChats();
      }
    }
    renderHistory(historySearch.value || '');
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('click', (e) => e.stopPropagation());
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function countTurns(conv) {
  if (!Array.isArray(conv)) return 0;
  return conv.filter((m) => m.role === 'user').length;
}

async function loadChat(c) {
  currentChatId = c.id;
  conversation = JSON.parse(JSON.stringify(c.conversation || [])); // deep clone
  setMode(c.mode || 'chat', false);
  // Try to set the same model
  if (c.model) {
    const found = [...modelSelect.options].find((o) => o.value === c.model);
    if (found) modelSelect.value = c.model;
  }
  renderConversation();
  closeHistory();
  inputEl.focus();
}

// Re-render entire conversation from data (for resume)
function renderConversation() {
  messagesEl.replaceChildren();
  if (!conversation.length) { renderEmptyState(); return; }
  for (const m of conversation) {
    if (m.role === 'user') {
      const text = typeof m.content === 'string'
        ? m.content
        : (Array.isArray(m.content) ? m.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n') : '');
      // Skip pure tool_result messages (synthetic)
      if (Array.isArray(m.content) && m.content.every((c) => c.type === 'tool_result')) continue;
      if (text) appendUserMessage(text, /*persist=*/false);
    } else if (m.role === 'assistant') {
      const ui = createAssistantMessage();
      let buf = '';
      if (typeof m.content === 'string') buf = m.content;
      else if (Array.isArray(m.content)) {
        for (const blk of m.content) {
          if (blk.type === 'text') buf += blk.text;
          else if (blk.type === 'tool_use') {
            const card = createToolCard(blk.name);
            setToolInput(card, blk.input || {});
            // result not visualizable from saved data
            setToolResult(card, '(loaded from history)', false);
          }
        }
      }
      if (buf) renderMarkdown(buf, ui.body);
      attachAssistantActions(ui.wrap, () => buf);
    }
  }
  scrollToBottom();
}

// =====================================================================
// Tools drawer
// =====================================================================

function renderToolsList() {
  toolsList.replaceChildren();
  for (const t of ALL_TOOLS) {
    const row = document.createElement('label');
    row.className = 'tool-toggle';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = toolWhitelist.has(t.name);
    cb.addEventListener('change', () => {
      if (cb.checked) toolWhitelist.add(t.name);
      else toolWhitelist.delete(t.name);
      saveAgentPrefs();
    });
    const code = document.createElement('code');
    code.textContent = t.name;
    const desc = document.createElement('span');
    desc.className = 'desc';
    desc.textContent = (t.description || '').split('. ')[0];
    row.appendChild(cb);
    row.appendChild(code);
    row.appendChild(desc);
    toolsList.appendChild(row);
  }
}

function setAllTools(enable) {
  if (enable) toolWhitelist = new Set(ALL_TOOLS.map((t) => t.name));
  else toolWhitelist = new Set();
  renderToolsList();
  saveAgentPrefs();
}

// =====================================================================
// Recordings drawer
// =====================================================================

function renderRecList() {
  recList.replaceChildren();
  if (!savedRecordings.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:6px 0; color:var(--text-dim); font-size:12px;';
    empty.textContent = 'No recordings yet. Click ⏺ Record, run an agent task, then save.';
    recList.appendChild(empty);
    return;
  }
  for (const r of savedRecordings) {
    const row = document.createElement('div');
    row.className = 'rec-row';
    const name = document.createElement('span');
    name.className = 'rec-name';
    name.textContent = r.name;
    const meta = document.createElement('span');
    meta.className = 'rec-meta';
    meta.textContent = `${r.steps.length} steps`;
    const playBtn = document.createElement('button');
    playBtn.className = 'ghost-mini';
    playBtn.textContent = '▶ Replay';
    playBtn.addEventListener('click', () => replayRecording(r));
    const delBtn = document.createElement('button');
    delBtn.className = 'ghost-mini';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', async () => {
      savedRecordings = savedRecordings.filter((x) => x.id !== r.id);
      await saveRecordings();
      renderRecList();
    });
    row.appendChild(name);
    row.appendChild(meta);
    row.appendChild(playBtn);
    row.appendChild(delBtn);
    recList.appendChild(row);
  }
}

function startRecording() {
  recordingActive = true;
  recordedSteps = [];
  recBadge.classList.remove('hidden');
  recRecord.textContent = '■ Stop';
}

async function stopRecordingAndSave() {
  recordingActive = false;
  recBadge.classList.add('hidden');
  recRecord.textContent = '⏺ Record';
  if (!recordedSteps.length) return;
  const name = prompt('Save recording as:', `Recording ${new Date().toLocaleString()}`);
  if (!name) return;
  savedRecordings.unshift({ id: 'rec_' + Date.now(), name, steps: recordedSteps, createdAt: Date.now() });
  await saveRecordings();
  renderRecList();
  setHint(`Saved "${name}" (${recordedSteps.length} steps).`);
}

async function replayRecording(rec) {
  setHint(`Replaying "${rec.name}"…`);
  setMode('agent');
  const lines = [`Replay these recorded steps in order:`];
  for (let i = 0; i < rec.steps.length; i++) {
    const s = rec.steps[i];
    lines.push(`${i + 1}. ${s.name}(${JSON.stringify(s.input || {})})`);
  }
  inputEl.value = lines.join('\n');
  autoResize();
  recDrawer.classList.add('hidden');
  await send();
}

// =====================================================================
// Approval modal
// =====================================================================

function askApproval(info) {
  return new Promise((resolve) => {
    approvalReason.textContent = info.reason || `Allow ${info.name}?`;
    approvalDetails.textContent = `${info.name}\n${JSON.stringify(info.input || {}, null, 2)}`;
    approvalBackdrop.classList.remove('hidden');
    const onAllow = () => { cleanup(); resolve(true); };
    const onDeny = () => { cleanup(); resolve(false); };
    function cleanup() {
      approvalBackdrop.classList.add('hidden');
      approvalAllow.removeEventListener('click', onAllow);
      approvalDeny.removeEventListener('click', onDeny);
    }
    approvalAllow.addEventListener('click', onAllow);
    approvalDeny.addEventListener('click', onDeny);
  });
}

// =====================================================================
// Indicators
// =====================================================================

async function indicatorBroadcast(msg) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    for (const t of tabs) { if (t.id) chrome.tabs.sendMessage(t.id, msg).catch(() => {}); }
  } catch {}
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'CC_STOP_REQUESTED') abortCtrl?.abort();
  if (msg?.type === 'CC_ATTACH_FILE') renderAttachmentCard(msg);
});

function renderAttachmentCard({ filename, mime_type, data_url, size, caption }) {
  ensureNoEmpty();
  const wrap = document.createElement('div');
  wrap.className = 'attachment-card';

  // Caption (optional)
  if (caption) {
    const cap = document.createElement('div');
    cap.className = 'attachment-caption';
    cap.textContent = caption;
    wrap.appendChild(cap);
  }

  // Inline image preview if it's an image
  if (mime_type && mime_type.startsWith('image/')) {
    const img = document.createElement('img');
    img.className = 'attachment-image';
    img.src = data_url;
    img.alt = filename;
    img.addEventListener('click', () => showImageZoom(data_url));
    wrap.appendChild(img);
  }

  // File row: icon + filename + size + download
  const row = document.createElement('div');
  row.className = 'attachment-row';
  const icon = document.createElement('div');
  icon.className = 'attachment-icon';
  icon.textContent = iconForMime(mime_type);
  const meta = document.createElement('div');
  meta.className = 'attachment-meta';
  const name = document.createElement('div');
  name.className = 'attachment-name';
  name.textContent = filename;
  const sizeEl = document.createElement('div');
  sizeEl.className = 'attachment-size';
  sizeEl.textContent = formatBytes(size || 0);
  meta.appendChild(name);
  meta.appendChild(sizeEl);

  const dl = document.createElement('a');
  dl.className = 'attachment-download';
  dl.href = data_url;
  dl.download = filename;
  dl.textContent = '⬇';
  dl.title = 'Download';

  row.appendChild(icon);
  row.appendChild(meta);
  row.appendChild(dl);
  wrap.appendChild(row);

  // Optional inline preview for text-y files (CSV, JSON, plaintext, code)
  if (mime_type && /^(text\/|application\/(json|xml|x-yaml|javascript))/.test(mime_type) && size < 100_000) {
    try {
      const b64 = data_url.split(',')[1];
      const text = decodeURIComponent(escape(atob(b64)));
      if (text.length < 8000) {
        const pre = document.createElement('pre');
        pre.className = 'attachment-preview';
        pre.textContent = text;
        wrap.appendChild(pre);
      }
    } catch {}
  }

  messagesEl.appendChild(wrap);
  scrollToBottom();
}

function iconForMime(mime) {
  if (!mime) return '📄';
  if (mime.startsWith('image/')) return '🖼';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('json') || mime.includes('yaml')) return '⚙';
  if (mime.includes('csv') || mime.includes('spreadsheet')) return '📊';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('compressed')) return '📦';
  if (mime.startsWith('text/')) return '📝';
  return '📎';
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// =====================================================================
// UI helpers
// =====================================================================

function renderEmptyState() {
  messagesEl.replaceChildren();
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  const icon = document.createElement('div');
  icon.className = 'empty-icon brand';
  if (mode === 'agent') {
    icon.textContent = '🤖';
  } else {
    const img = document.createElement('img');
    img.src = 'icons/icon-128.png';
    img.alt = 'MoonBridge';
    img.style.cssText = 'width:48px;height:48px;border-radius:12px;object-fit:cover;';
    icon.replaceChildren(img);
    icon.style.background = 'transparent';
  }
  const title = document.createElement('div');
  title.className = 'empty-title';
  title.textContent = mode === 'agent' ? 'Agent mode' : 'MoonBridge';
  const sub = document.createElement('div');
  sub.className = 'empty-sub';
  if (!settings.apiToken) {
    sub.textContent = 'Open Settings to add your API token.';
  } else {
    sub.textContent = mode === 'agent'
      ? 'I can read pages, click, type, switch tabs, and more. Try:'
      : 'Pick an example or type a question.';
  }
  empty.appendChild(icon);
  empty.appendChild(title);
  empty.appendChild(sub);

  if (settings.apiToken) {
    const chips = document.createElement('div');
    chips.className = 'example-chips';
    const list = mode === 'agent' ? EXAMPLES_AGENT : EXAMPLES_CHAT;
    for (const ex of list) {
      const c = document.createElement('button');
      c.className = 'example-chip';
      const em = document.createElement('span');
      em.className = 'chip-emoji';
      em.textContent = ex.e;
      const tx = document.createElement('span');
      tx.textContent = ex.t;
      c.appendChild(em);
      c.appendChild(tx);
      c.addEventListener('click', () => {
        inputEl.value = ex.t;
        autoResize();
        send();
      });
      chips.appendChild(c);
    }
    empty.appendChild(chips);
  }
  messagesEl.appendChild(empty);
}

function ensureNoEmpty() {
  const e = messagesEl.querySelector('.empty-state');
  if (e) e.remove();
}

function appendUserMessage(text, persist = true, attachments = null, msgIdx = null) {
  ensureNoEmpty();
  const div = document.createElement('div');
  div.className = 'msg user';
  if (msgIdx != null) div.dataset.idx = msgIdx;

  if (attachments && attachments.length) {
    const attsRow = document.createElement('div');
    attsRow.className = 'user-attachments';
    for (const a of attachments) {
      if (a.kind === 'image' && a.dataUrl) {
        const img = document.createElement('img');
        img.src = a.dataUrl;
        img.alt = a.name;
        img.title = a.name;
        attsRow.appendChild(img);
      } else {
        const tag = document.createElement('span');
        tag.className = 'user-att-text';
        tag.textContent = `${kindIcon(a.kind)} ${a.name}`;
        attsRow.appendChild(tag);
      }
    }
    div.appendChild(attsRow);
  }

  const body = document.createElement('div');
  body.textContent = text;
  div.appendChild(body);

  // Hover actions: Copy, Edit (resend with edit)
  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  const copy = makeAction('📋', 'Copy', () => {
    navigator.clipboard.writeText(text);
    flashAction(copy, 'Copied');
  });

  const edit = makeAction('✏️', 'Edit & resend', () => {
    inputEl.value = text;
    autoResize();
    inputEl.focus();
    setHint('Edit and press Enter to resend');
  });

  actions.appendChild(copy);
  actions.appendChild(edit);
  div.appendChild(actions);
  messagesEl.appendChild(div);
  // Force scroll: user just sent this, always show it
  forceScrollToBottom();
}

function makeAction(emoji, label, handler) {
  const btn = document.createElement('button');
  btn.className = 'msg-action';
  btn.title = label;
  btn.innerHTML = `<span class="ma-icon">${emoji}</span><span class="ma-label">${label}</span>`;
  btn.addEventListener('click', handler);
  return btn;
}

function flashAction(btn, text) {
  const lab = btn.querySelector('.ma-label');
  if (!lab) return;
  const orig = lab.textContent;
  lab.textContent = text;
  btn.classList.add('copied');
  setTimeout(() => { lab.textContent = orig; btn.classList.remove('copied'); }, 1200);
}

function attachAssistantActions(wrap, getText, msgIdx) {
  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  const copy = makeAction('📋', 'Copy', () => {
    const text = getText();
    if (!text) return;
    navigator.clipboard.writeText(text);
    flashAction(copy, 'Copied');
  });

  const regen = makeAction('↻', 'Regenerate', async () => {
    if (abortCtrl) return;
    while (conversation.length && conversation[conversation.length - 1].role !== 'user') conversation.pop();
    renderConversation();
    if (mode === 'agent') await runAgentTurn();
    else {
      const last = conversation[conversation.length - 1];
      const userText = typeof last?.content === 'string' ? last.content : '';
      conversation.pop();
      await sendChat(userText, last?.content || userText);
    }
  });

  const branch = makeAction('🌿', 'Branch', async () => {
    await saveCurrentChat();
    const prefix = conversation.slice();
    currentChatId = null;
    conversation = JSON.parse(JSON.stringify(prefix));
    renderConversation();
    setHint('Branched into a new chat');
    inputEl.focus();
  });

  const speak = makeAction('🔊', 'Speak', () => {
    const text = getText();
    if (!text) return;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      flashAction(speak, 'Stopped');
      return;
    }
    const u = new SpeechSynthesisUtterance(text.slice(0, 5000));
    u.rate = 1.0;
    window.speechSynthesis.speak(u);
    flashAction(speak, 'Speaking…');
  });

  const like = makeAction('👍', 'Helpful', async () => {
    await recordFeedback(msgIdx, 'like', getText());
    like.classList.add('liked');
    dislike.classList.remove('disliked');
    flashAction(like, 'Thanks!');
  });

  const dislike = makeAction('👎', 'Not helpful', async () => {
    await recordFeedback(msgIdx, 'dislike', getText());
    dislike.classList.add('disliked');
    like.classList.remove('liked');
    flashAction(dislike, 'Noted');
  });

  actions.appendChild(copy);
  actions.appendChild(regen);
  actions.appendChild(branch);
  actions.appendChild(speak);
  actions.appendChild(like);
  actions.appendChild(dislike);
  wrap.appendChild(actions);
}

async function recordFeedback(msgIdx, kind, text) {
  try {
    const { feedback = [] } = await chrome.storage.local.get(['feedback']);
    feedback.push({
      ts: Date.now(),
      kind,
      preview: (text || '').slice(0, 200),
      chatId: currentChatId,
      msgIdx,
    });
    if (feedback.length > 500) feedback.shift();
    await safeStorageSet({ feedback });
  } catch {}
}

function createAssistantMessage() {
  ensureNoEmpty();
  const wrap = document.createElement('div');
  wrap.className = 'msg assistant';

  // Avatar + name header (Claude Chrome style)
  const head = document.createElement('div');
  head.className = 'assistant-head';
  const avatar = document.createElement('img');
  avatar.className = 'assistant-avatar';
  avatar.src = 'icons/icon-128.png';
  avatar.alt = 'MoonBridge';
  const name = document.createElement('span');
  name.className = 'assistant-name';
  name.textContent = 'MoonBridge';
  head.appendChild(avatar);
  head.appendChild(name);

  const thinkBlock = document.createElement('div');
  thinkBlock.className = 'thinking-block hidden';
  const thinkToggle = document.createElement('span');
  thinkToggle.className = 'thinking-toggle';
  thinkToggle.textContent = '▸ Thinking';
  const thinkBody = document.createElement('div');
  thinkBody.className = 'thinking-body';
  thinkToggle.addEventListener('click', () => {
    thinkBlock.classList.toggle('open');
    thinkToggle.textContent = thinkBlock.classList.contains('open') ? '▾ Thinking' : '▸ Thinking';
  });
  thinkBlock.appendChild(thinkToggle);
  thinkBlock.appendChild(thinkBody);
  const body = document.createElement('div');
  body.className = 'assistant-body';
  wrap.appendChild(head);
  wrap.appendChild(thinkBlock);
  wrap.appendChild(body);
  messagesEl.appendChild(wrap);
  scrollToBottom();
  return { wrap, thinkBlock, thinkBody, body };
}

function appendError(text) {
  ensureNoEmpty();
  const div = document.createElement('div');
  div.className = 'msg system-error';
  div.textContent = text;
  messagesEl.appendChild(div);
  scrollToBottom();
}

// Compact single-line ticker — replaces bulky thinking block.
// Shows: last line of thinking, OR current tool action.
// Click to expand and see full thinking history.
function createThinkingStream() {
  ensureNoEmpty();
  const wrap = document.createElement('div');
  wrap.className = 'ticker';
  const icon = document.createElement('span');
  icon.className = 'ticker-icon';
  icon.textContent = '✦';
  const line = document.createElement('span');
  line.className = 'ticker-line';
  line.textContent = 'Thinking…';
  const expand = document.createElement('div');
  expand.className = 'ticker-expand';
  wrap.appendChild(icon);
  wrap.appendChild(line);
  wrap.appendChild(expand);
  wrap.title = 'Click to expand';
  wrap.addEventListener('click', () => {
    wrap.classList.toggle('expanded');
  });
  messagesEl.appendChild(wrap);
  scrollToBottom();
  return {
    wrap,
    body: expand,        // full history shown when expanded
    line,                // single-line current display
    toggle: { textContent: '' },  // backcompat shim
    icon,
  };
}

// Update the ticker line with current activity. Mode: 'thinking' | 'action' | 'idle'.
function setTickerLine(stream, text, mode = 'thinking') {
  if (!stream) return;
  // Take only the LAST line of any multi-line text — keeps ticker single-row
  const lastLine = String(text).trim().split('\n').filter(Boolean).pop() || '';
  // Truncate visually with ellipsis (CSS handles it, but keep DOM clean)
  stream.line.textContent = lastLine || (mode === 'action' ? 'Working…' : 'Thinking…');
  stream.wrap.dataset.mode = mode;
  if (mode === 'action') stream.icon.textContent = '⚡';
  else if (mode === 'idle') stream.icon.textContent = '✓';
  else stream.icon.textContent = '✦';
}

function appendIterMarker(n) {
  // Intentional no-op — turn separators were noisy.
  // Kept as a stub so existing call sites don't break.
}

// =====================================================================
// AGENT ACTIVITY TIMELINE — premium batch UI
// =====================================================================

const ACTION_VERBS = {
  get_page: 'Read page', read_tab: 'Read tab', page_summary: 'Summarize page',
  find_element: 'Find element', find_by_text: 'Search by text',
  extract_links: 'Extract links', get_console: 'Read console',
  dom_snapshot: 'Snapshot DOM', get_value: 'Read value',
  get_attribute: 'Read attribute', get_text: 'Read text',
  click: 'Click', double_click: 'Double-click', triple_click: 'Triple-click',
  hover: 'Hover', type: 'Type', key_press: 'Key press',
  select_option: 'Select option', fill_form: 'Fill form',
  scroll: 'Scroll', scroll_to: 'Scroll to', scroll_until: 'Scroll until',
  drag_drop: 'Drag', mouse_drag: 'Mouse drag',
  wait: 'Wait', wait_for: 'Wait for', wait_for_idle: 'Wait for idle',
  navigate: 'Navigate', back: 'Go back', forward: 'Go forward',
  reload: 'Reload', screenshot: 'Capture screenshot',
  element_screenshot: 'Capture element', execute_js: 'Run JS',
  list_tabs: 'List tabs', switch_tab: 'Switch tab',
  new_tab: 'Open tab', close_tab: 'Close tab', duplicate_tab: 'Duplicate tab',
  list_windows: 'List windows', new_window: 'Open window',
  focus_window: 'Focus window', close_window: 'Close window',
  move_tab: 'Move tab', resize_window: 'Resize window',
  set_zoom: 'Set zoom', get_zoom: 'Get zoom',
  click_and_read: 'Click + read', navigate_and_read: 'Navigate + read',
  network_log: 'Network log', network_response: 'Network response',
  screenshot_snapshot: 'Snapshot baseline', screenshot_compare: 'Compare visual',
  list_frames: 'List frames', web_search: 'Search web',
  youtube_transcript: 'Read transcript', read_pdf: 'Read PDF',
  fetch_url: 'Fetch URL', download_file: 'Download',
  save_text: 'Save file', upload_image: 'Upload image',
  read_storage: 'Read storage', write_storage: 'Write storage',
  read_cookies: 'Read cookies',
  clipboard_read: 'Read clipboard', clipboard_write: 'Write clipboard',
  remember: 'Remember', forget: 'Forget', recall_memories: 'Recall memories',
  search_kb: 'Search KB', list_kb: 'List KB',
  scratchpad_set: 'Save scratchpad', scratchpad_get: 'Read scratchpad',
  scratchpad_list: 'List scratchpad',
  note_save: 'Save note', note_get: 'Read note',
  note_list: 'List notes', note_delete: 'Delete note',
  get_page_diff: 'Diff page', batch: 'Batch',
  update_plan: 'Update plan', gif_capture: 'Capture frames',
  list_chat_attachments: 'List attachments', get_chat_attachment: 'Read attachment',
  upload_image: 'Upload file',
};

const ACTION_ICONS = {
  get_page: '📄', read_tab: '📑', page_summary: '📋',
  find_element: '🔎', find_by_text: '🔍', extract_links: '🔗',
  get_console: '🪵', dom_snapshot: '🌳',
  get_value: '◇', get_attribute: '◇', get_text: '◇',
  click: '👆', double_click: '🖱', triple_click: '🖱',
  hover: '✋', type: '⌨', key_press: '⌨',
  select_option: '▼', fill_form: '📝',
  scroll: '↕', scroll_to: '↕', scroll_until: '↕',
  drag_drop: '⇄', mouse_drag: '⇄',
  wait: '⏱', wait_for: '⏳', wait_for_idle: '⏳',
  navigate: '🌐', back: '←', forward: '→',
  reload: '↻', screenshot: '📷', element_screenshot: '🖼',
  execute_js: '𝒥𝒮',
  list_tabs: '🗂', switch_tab: '⇄', new_tab: '🆕',
  close_tab: '✕', duplicate_tab: '⎘',
  list_windows: '🪟', new_window: '🪟',
  focus_window: '🪟', close_window: '✕',
  move_tab: '↔', resize_window: '⤡',
  set_zoom: '🔍', get_zoom: '🔍',
  click_and_read: '👆', navigate_and_read: '🌐',
  network_log: '📡', network_response: '📡',
  screenshot_snapshot: '📷', screenshot_compare: '🖼',
  list_frames: '🖼', web_search: '🌐',
  youtube_transcript: '▶', read_pdf: '📄',
  fetch_url: '🌐', download_file: '⬇',
  save_text: '💾', upload_image: '⬆',
  read_storage: '🗄', write_storage: '🗄',
  read_cookies: '🍪',
  clipboard_read: '📋', clipboard_write: '📋',
  remember: '🧠', forget: '🧠', recall_memories: '🧠',
  search_kb: '📚', list_kb: '📚',
  scratchpad_set: '✏️', scratchpad_get: '✏️', scratchpad_list: '✏️',
  note_save: '📝', note_get: '📝',
  note_list: '📝', note_delete: '✕',
  get_page_diff: '🔀', batch: '⚡',
  update_plan: '📋', gif_capture: '🎬',
  list_chat_attachments: '📎', get_chat_attachment: '📎',
  upload_image: '⬆️',
};

// Tool → category, for premium batch titles ("Searching web", "Reading page" …)
const TOOL_CATEGORY = {
  // read / extract
  get_page: 'read', read_tab: 'read', page_summary: 'read', get_console: 'read',
  dom_snapshot: 'read', get_value: 'read', get_attribute: 'read', get_text: 'read',
  get_visible_text: 'read', get_page_structure: 'read', get_accessibility_tree: 'read',
  extract_links: 'read', extract_table: 'read', extract_form_data: 'read',
  extract_list: 'read', extract_metadata: 'read', extract_contacts: 'read',
  extract_images: 'read', find_clickable: 'read', get_element_info: 'read',
  // interact
  click: 'interact', double_click: 'interact', triple_click: 'interact',
  hover: 'interact', type: 'interact', key_press: 'interact', smart_click: 'interact',
  smart_type: 'interact', select_option: 'interact', fill_form: 'interact',
  drag_drop: 'interact', mouse_drag: 'interact', scroll: 'interact',
  scroll_to: 'interact', scroll_until: 'interact',
  // navigate
  navigate: 'navigate', back: 'navigate', forward: 'navigate', reload: 'navigate',
  click_and_read: 'navigate', navigate_and_read: 'navigate',
  wait_for_navigation: 'navigate',
  // search
  web_search: 'search', find_element: 'search', find_by_text: 'search',
  ai_find_element: 'search',
  // capture
  screenshot: 'capture', element_screenshot: 'capture', gif_capture: 'capture',
  screenshot_snapshot: 'capture', screenshot_compare: 'capture',
  ocr_image: 'capture', read_pdf: 'capture',
  // tab/window
  list_tabs: 'tabs', switch_tab: 'tabs', new_tab: 'tabs', close_tab: 'tabs',
  duplicate_tab: 'tabs', list_windows: 'tabs', new_window: 'tabs',
  focus_window: 'tabs', close_window: 'tabs', move_tab: 'tabs',
  resize_window: 'tabs', set_zoom: 'tabs', get_zoom: 'tabs',
  // ai
  ai_summarize: 'ai', ai_describe_page: 'ai', ai_extract_data: 'ai',
  // network / fetch
  network_log: 'network', network_response: 'network', fetch_url: 'network',
  download_file: 'network',
  // storage / db
  read_storage: 'storage', write_storage: 'storage', read_cookies: 'storage',
  db_set: 'storage', db_get: 'storage', db_query: 'storage', db_delete: 'storage',
  workspace_write: 'storage', workspace_read: 'storage', workspace_delete: 'storage',
  // memory
  remember: 'memory', forget: 'memory', recall_memories: 'memory',
  search_kb: 'memory', list_kb: 'memory',
  scratchpad_set: 'memory', scratchpad_get: 'memory', scratchpad_list: 'memory',
  note_save: 'memory', note_get: 'memory', note_list: 'memory', note_delete: 'memory',
  // wait
  wait: 'wait', wait_for: 'wait', wait_for_idle: 'wait', wait_for_element_state: 'wait',
  // workflow
  batch: 'workflow', conditional_step: 'workflow', loop_until: 'workflow',
  retry_with_backoff: 'workflow', update_plan: 'workflow',
  // system
  health_check: 'system', set_readonly: 'system',
  clipboard_read: 'system', clipboard_write: 'system',
  execute_js: 'system', save_text: 'system', upload_image: 'system',
  list_chat_attachments: 'system', get_chat_attachment: 'system',
};

const CATEGORY_LABEL = {
  read:     { running: 'Reading',          done: 'Read'          },
  interact: { running: 'Interacting',      done: 'Interacted'    },
  navigate: { running: 'Navigating',       done: 'Navigated'     },
  search:   { running: 'Searching',        done: 'Searched'      },
  capture:  { running: 'Capturing',        done: 'Captured'      },
  tabs:     { running: 'Managing tabs',    done: 'Managed tabs'  },
  ai:       { running: 'Asking AI',        done: 'AI response'   },
  network:  { running: 'Fetching',         done: 'Fetched'       },
  storage:  { running: 'Storing data',     done: 'Stored'        },
  memory:   { running: 'Recalling memory', done: 'Memory'        },
  wait:     { running: 'Waiting',          done: 'Waited'        },
  workflow: { running: 'Running workflow', done: 'Workflow'      },
  system:   { running: 'Running',          done: 'Done'          },
};

function _dominantCategory(batch) {
  if (!batch) return null;
  const items = batch.querySelectorAll('.activity-item');
  if (!items.length) return null;
  const counts = {};
  for (const it of items) {
    const t = it.dataset.tool || '';
    const cat = TOOL_CATEGORY[t] || 'system';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  let best = null, max = 0;
  for (const [cat, n] of Object.entries(counts)) {
    if (n > max) { max = n; best = cat; }
  }
  const distinctCats = Object.keys(counts).length;
  return { cat: best, max, distinct: distinctCats, total: items.length };
}

// Active batch container (one per agent iteration)
let _currentBatch = null;
const _toolToItem = new Map(); // tool_use_id -> { item, card, batch }

function ensureBatchForCurrentTurn() {
  if (_currentBatch && !_currentBatch.dataset.completed) return _currentBatch;
  ensureNoEmpty();

  const wrap = document.createElement('div');
  wrap.className = 'activity-batch running pending';

  const head = document.createElement('div');
  head.className = 'batch-head';
  const status = document.createElement('span');
  status.className = 'batch-status';
  const title = document.createElement('div');
  title.className = 'batch-title';
  const titleText = document.createElement('span');
  titleText.textContent = 'Working';
  const progress = document.createElement('span');
  progress.className = 'batch-progress';
  progress.textContent = '0/0';
  title.appendChild(titleText);
  title.appendChild(progress);
  const chev = document.createElement('span');
  chev.className = 'batch-chevron';
  chev.textContent = '▶';

  head.appendChild(status);
  head.appendChild(title);
  head.appendChild(chev);

  const body = document.createElement('div');
  body.className = 'batch-body';

  wrap.appendChild(head);
  wrap.appendChild(body);

  // Auto-collapse old completed batches
  const olderBatches = messagesEl.querySelectorAll('.activity-batch.completed:not(.collapsed)');
  if (olderBatches.length > 1) {
    olderBatches[olderBatches.length - 2].classList.add('collapsed');
  }

  head.addEventListener('click', () => {
    wrap.classList.toggle('collapsed');
  });

  messagesEl.appendChild(wrap);
  scrollToBottom();

  wrap.dataset.total = '0';
  wrap.dataset.done = '0';
  _currentBatch = wrap;
  return wrap;
}

function batchUpdateProgress(batch) {
  if (!batch) return;
  const total = parseInt(batch.dataset.total || '0', 10);
  const done = parseInt(batch.dataset.done || '0', 10);
  const failed = parseInt(batch.dataset.failed || '0', 10);
  const titleEl = batch.querySelector('.batch-title span:first-child');
  const progEl = batch.querySelector('.batch-progress');
  if (progEl) progEl.textContent = `${done}/${total}`;
  if (titleEl) {
    const items = batch.querySelectorAll('.activity-item');
    const dom = _dominantCategory(batch);
    const running = batch.querySelector('.activity-item.running .action-text');

    if (done < total) {
      // RUNNING — prefer running step's verb if it's the only/last one
      if (running && items.length === 1) {
        titleEl.textContent = running.textContent;
      } else if (dom && dom.distinct === 1) {
        titleEl.textContent = (CATEGORY_LABEL[dom.cat] || CATEGORY_LABEL.system).running;
      } else if (running) {
        titleEl.textContent = running.textContent;
      } else if (dom) {
        titleEl.textContent = (CATEGORY_LABEL[dom.cat] || CATEGORY_LABEL.system).running;
      } else {
        titleEl.textContent = 'Working';
      }
    } else {
      // DONE — descriptive done state
      if (items.length === 1) {
        const txt = items[0].querySelector('.action-text')?.textContent || 'Done';
        titleEl.textContent = txt;
      } else if (dom && dom.distinct === 1) {
        const lbl = (CATEGORY_LABEL[dom.cat] || CATEGORY_LABEL.system).done;
        titleEl.textContent = `${lbl} · ${total} step${total > 1 ? 's' : ''}`;
      } else {
        titleEl.textContent = `${total} action${total > 1 ? 's' : ''}`;
      }
    }
  }
  if (done >= total && total > 0) {
    batch.classList.remove('running', 'pending');
    if (failed > 0) batch.classList.add('failed');
    else batch.classList.add('completed');
    batch.dataset.completed = '1';
  }
}

function finalizeBatch() {
  if (_currentBatch) {
    const b = _currentBatch;
    b.classList.remove('running', 'pending');
    if (b.dataset.failed && parseInt(b.dataset.failed) > 0) {
      b.classList.add('failed');
    } else {
      b.classList.add('completed');
      // Auto-compact successful batches after a short read window so the
      // long expanded timeline collapses into a single ✓ summary row.
      // Failed batches stay expanded for inspection.
      setTimeout(() => {
        if (b.isConnected && !b.classList.contains('failed')) {
          b.classList.add('auto-compact');
          b.classList.add('collapsed');
        }
      }, 1400);
    }
    b.dataset.completed = '1';
  }
  _currentBatch = null;
}

function startNewBatch() {
  if (_currentBatch) {
    const b = _currentBatch;
    b.classList.remove('running', 'pending');
    b.classList.add('completed');
    b.dataset.completed = '1';
    // Previous batch — collapse immediately so the new one doesn't push
    // a wall of completed-step rows down the chat.
    if (!b.classList.contains('failed')) {
      b.classList.add('auto-compact');
      b.classList.add('collapsed');
    }
  }
  _currentBatch = null;
}

function createActivityItem(toolName) {
  const batch = ensureBatchForCurrentTurn();
  batch.dataset.total = String(parseInt(batch.dataset.total || '0', 10) + 1);

  const item = document.createElement('div');
  item.className = 'activity-item running pending';
  item.dataset.tool = toolName;

  const icon = document.createElement('span');
  icon.className = 'action-icon';
  icon.textContent = ACTION_ICONS[toolName] || '◌';

  const content = document.createElement('div');
  content.className = 'action-content';

  const line = document.createElement('div');
  line.className = 'action-line';
  const verb = document.createElement('span');
  verb.className = 'action-text';
  verb.textContent = ACTION_VERBS[toolName] || toolName;
  const summary = document.createElement('span');
  summary.className = 'action-summary';
  const badge = document.createElement('span');
  badge.className = 'tool-badge';
  badge.textContent = toolName;
  const meta = document.createElement('span');
  meta.className = 'action-meta';

  line.appendChild(verb);
  line.appendChild(summary);
  line.appendChild(badge);
  line.appendChild(meta);
  content.appendChild(line);

  const detail = document.createElement('div');
  detail.className = 'action-detail';

  content.addEventListener('click', () => item.classList.toggle('open'));

  item.appendChild(icon);
  item.appendChild(content);
  item.appendChild(detail);
  batch.querySelector('.batch-body').appendChild(item);

  batchUpdateProgress(batch);
  scrollToBottom();

  return { item, batch, summary, meta, detail, _name: toolName, _started: Date.now() };
}

function setActivityInput(card, input) {
  if (!card) return;
  card.summary.textContent = summarizeInput(card._name || '', input);
  let s = card.detail.querySelector('[data-sec="input"]');
  if (!s) {
    s = document.createElement('div');
    s.className = 'action-detail-section';
    s.dataset.sec = 'input';
    const lab = document.createElement('div');
    lab.className = 'action-detail-label';
    lab.textContent = 'input';
    const pre = document.createElement('pre');
    s.appendChild(lab); s.appendChild(pre);
    card.detail.appendChild(s);
  }
  s.querySelector('pre').textContent = JSON.stringify(input, null, 2);
}

function setActivityResult(card, content, isError, dataUrl) {
  if (!card) return;
  const dur = Math.round((Date.now() - card._started) / 100) / 10;
  card.meta.textContent = `${dur}s`;
  card.item.classList.remove('running', 'pending');
  if (isError) {
    card.item.classList.add('failed');
    const batch = card.batch;
    batch.dataset.failed = String(parseInt(batch.dataset.failed || '0', 10) + 1);
  } else {
    card.item.classList.add('completed');
  }

  let s = card.detail.querySelector('[data-sec="result"]');
  if (!s) {
    s = document.createElement('div');
    s.className = 'action-detail-section';
    s.dataset.sec = 'result';
    const lab = document.createElement('div');
    lab.className = 'action-detail-label';
    lab.textContent = isError ? 'error' : 'result';
    const pre = document.createElement('pre');
    s.appendChild(lab); s.appendChild(pre);
    card.detail.appendChild(s);
  }
  let textOut = '';
  if (typeof content === 'string') textOut = content;
  else if (Array.isArray(content)) textOut = content.map((c) => c.type === 'text' ? c.text : `[${c.type}]`).join('\n');
  else textOut = JSON.stringify(content);
  s.querySelector('pre').textContent = textOut.slice(0, 4000);

  if (dataUrl) {
    // Thumbnail in batch head
    if (!card.batch.querySelector('.batch-thumb')) {
      const thumb = document.createElement('img');
      thumb.className = 'batch-thumb';
      thumb.src = dataUrl;
      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        showImageZoom(dataUrl);
      });
      const head = card.batch.querySelector('.batch-head');
      head.insertBefore(thumb, head.querySelector('.batch-chevron'));
    }
    // Full image in detail
    let img = card.detail.querySelector('.action-detail-screenshot');
    if (!img) {
      img = document.createElement('img');
      img.className = 'action-detail-screenshot';
      img.addEventListener('click', () => showImageZoom(dataUrl));
      card.detail.appendChild(img);
    }
    img.src = dataUrl;
  }

  const batch = card.batch;
  batch.dataset.done = String(parseInt(batch.dataset.done || '0', 10) + 1);
  batchUpdateProgress(batch);
  scrollToBottom();
}

function showImageZoom(src) {
  const back = document.createElement('div');
  back.className = 'img-zoom-backdrop';
  const img = document.createElement('img');
  img.src = src;
  back.appendChild(img);
  back.addEventListener('click', () => back.remove());
  document.body.appendChild(back);
}

// Legacy createToolCard alias — now creates an activity item inside a batch.
// Kept for backward compatibility with existing call sites.
function createToolCard(name) {
  const card = createActivityItem(name);
  // Adapter shape so existing setToolInput/setToolResult callers keep working
  return {
    card: { classList: card.item.classList },
    head: null,
    summary: card.summary,
    body: card.detail,
    _name: name,
    _activity: card,
  };
}
function setToolInput(card, input) {
  if (card._activity) return setActivityInput(card._activity, input);
}
function setToolResult(card, content, isError, dataUrl) {
  if (card._activity) return setActivityResult(card._activity, content, isError, dataUrl);
}

function summarizeInput(name, input) {
  if (!input) return '';
  switch (name) {
    case 'click': return `${input.selector || ''}${input.tab_id ? ` (tab ${input.tab_id})` : ''}`;
    case 'type': return `${input.selector || ''} ← "${(input.text || '').slice(0, 30)}"${input.press_enter ? ' ⏎' : ''}`;
    case 'key_press': return input.keys || '';
    case 'navigate': return input.url || '';
    case 'scroll': return `${input.direction || ''}${input.selector ? ' in ' + input.selector : ''}`;
    case 'wait': return `${input.ms || 1000}ms`;
    case 'wait_for': return `${input.selector || ''}${input.text_contains ? ` ~ "${input.text_contains}"` : ''}`;
    case 'get_page': return input.tab_id ? `tab ${input.tab_id}` : '';
    case 'read_tab': return `tab ${input.tab_id}`;
    case 'find_element': return `"${input.query || ''}"`;
    case 'extract_links': return input.contains ? `~ "${input.contains}"` : '';
    case 'fill_form': return `${(input.fields || []).length} field(s)${input.submit ? ' + submit' : ''}`;
    case 'select_option': return `${input.selector} = "${input.value}"`;
    case 'switch_tab': return `id=${input.tab_id}`;
    case 'new_tab': return input.url || 'about:blank';
    case 'close_tab': return input.tab_id ? `id=${input.tab_id}` : 'active';
    case 'execute_js': return (input.code || '').slice(0, 60).replace(/\s+/g, ' ');
    default: return Object.keys(input).length ? JSON.stringify(input).slice(0, 60) : '';
  }
}

// rAF-throttled markdown renderer — coalesces streaming deltas into one paint.
// Uses a per-target queue keyed by the body element, so multiple concurrent
// streams don't stomp each other.
const _renderQueue = new WeakMap();
function streamRender(text, target) {
  _renderQueue.set(target, text);
  if (target.__mbRenderScheduled) return;
  target.__mbRenderScheduled = true;
  requestAnimationFrame(() => {
    target.__mbRenderScheduled = false;
    const latest = _renderQueue.get(target);
    if (latest != null) renderMarkdown(latest, target);
  });
}

// rAF-throttled scroll: coalesces high-frequency calls (one per paint).
const _scrollFollow = rafThrottle(() => {
  if (!userScrolledUp) {
    _programmaticScroll = true;
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (jumpPill) jumpPill.classList.remove('show');
    requestAnimationFrame(() => { _programmaticScroll = false; });
  } else {
    if (jumpPill) jumpPill.classList.add('show');
  }
});

function scrollToBottom(force = false) {
  // Always scroll if forced, OR if user hasn't manually scrolled up.
  // The old logic ("near bottom" 80px check) failed during streaming —
  // long responses pushed content past the threshold even when user was
  // following along, then auto-scroll silently stopped.
  if (force) {
    _programmaticScroll = true;
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (jumpPill) jumpPill.classList.remove('show');
    requestAnimationFrame(() => { _programmaticScroll = false; });
    return;
  }
  _scrollFollow();
}

function forceScrollToBottom() {
  userScrolledUp = false;
  _programmaticScroll = true;
  messagesEl.scrollTop = messagesEl.scrollHeight;
  if (jumpPill) jumpPill.classList.remove('show');
  requestAnimationFrame(() => { _programmaticScroll = false; });
}

// Track whether the user has deliberately scrolled away from the bottom.
// Programmatic scrolls (auto-scroll during streaming) don't set this.
let userScrolledUp = false;
let _programmaticScroll = false;

function setHint(msg) {
  hintEl.textContent = msg || '';
  if (msg) setTimeout(() => { if (hintEl.textContent === msg) hintEl.textContent = 'Shift+Enter for newline · Ctrl+E to toggle panel'; }, 6000);
}

// Inline status pill ("Thinking...", "Searching web...", etc)
let statusEl = null;
function showStatus(text) {
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.className = 'status-pill';
  }
  statusEl.innerHTML = '';
  const label = document.createElement('span');
  label.textContent = text;
  const dots = document.createElement('span');
  dots.className = 'dots';
  statusEl.appendChild(label);
  statusEl.appendChild(dots);
  if (!statusEl.parentNode) messagesEl.appendChild(statusEl);
  scrollToBottom();
}
function hideStatus() {
  if (statusEl?.parentNode) statusEl.remove();
  statusEl = null;
}
function statusForTool(name) {
  const map = {
    web_search: 'Searching the web',
    fetch_url: 'Fetching content',
    youtube_transcript: 'Reading transcript',
    read_pdf: 'Reading PDF',
    get_page: 'Reading page',
    page_summary: 'Reading page',
    read_tab: 'Reading tab',
    find_element: 'Finding element',
    find_by_text: 'Searching elements',
    extract_links: 'Extracting links',
    screenshot: 'Capturing screenshot',
    element_screenshot: 'Capturing element',
    screenshot_compare: 'Comparing screenshots',
    navigate: 'Navigating',
    new_tab: 'Opening new tab',
    list_tabs: 'Listing tabs',
    click: 'Clicking',
    type: 'Typing',
    fill_form: 'Filling form',
    upload_image: 'Uploading image',
    download_file: 'Downloading',
    save_text: 'Saving file',
    network_log: 'Reading network log',
    execute_js: 'Running JavaScript',
    batch: 'Running batch',
    remember: 'Saving memory',
    note_save: 'Saving note',
  };
  return map[name] || `Running ${name}`;
}

function autoResize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 220) + 'px';
}

function setStreaming(streaming) {
  sendBtn.classList.toggle('hidden', streaming);
  stopBtn.classList.toggle('hidden', !streaming);
  inputEl.disabled = streaming;
  // Toggle streaming cursor on the last assistant message
  const last = messagesEl.querySelector('.msg.assistant:last-of-type');
  if (last) last.classList.toggle('streaming', streaming);
}

function setMode(next, resetConv = true) {
  if (mode === next && !resetConv) return;
  mode = next;
  modeChatBtn.classList.toggle('active', mode === 'chat');
  modeAgentBtn.classList.toggle('active', mode === 'agent');
  modeChatBtn.setAttribute('aria-selected', mode === 'chat');
  modeAgentBtn.setAttribute('aria-selected', mode === 'agent');
  inputEl.placeholder = mode === 'agent' ? 'Tell the agent what to do…' : 'Message MoonBridge…';
  if (resetConv) {
    conversation = [];
    currentChatId = null;
    renderEmptyState();
  }
}

// =====================================================================
// CHAT MODE
// =====================================================================

async function sendChat(userText, userContent) {
  conversation.push({ role: 'user', content: userContent });
  const ui = createAssistantMessage();
  showStatus('Thinking');
  let textBuf = '';
  let thinkBuf = '';
  abortCtrl = new AbortController();
  setStreaming(true);
  try {
    for await (const ev of streamMessages({
      baseUrl: settings.baseUrl, apiToken: settings.apiToken,
      model: modelSelect.value || settings.defaultModel,
      system: settings.systemPrompt, messages: conversation,
      temperature: settings.temperature, maxTokens: settings.maxTokens,
      signal: abortCtrl.signal,
    })) {
      if (ev.type === 'thinking') {
        hideStatus();
        thinkBuf += ev.data;
        ui.thinkBlock.classList.remove('hidden');
        ui.thinkBody.textContent = thinkBuf;
        scrollToBottom();
      } else if (ev.type === 'text') {
        hideStatus();
        textBuf += ev.data;
        streamRender(textBuf, ui.body);
        scrollToBottom();
      } else if (ev.type === 'usage') {
        showUsage(ev.data);
      } else if (ev.type === 'error') {
        appendError(ev.data); textBuf = ''; break;
      } else if (ev.type === 'done') break;
    }
  } catch (e) {
    appendError(`Unexpected: ${e.message}`);
  } finally {
    hideStatus();
    setStreaming(false);
    abortCtrl = null;
    if (textBuf) {
      conversation.push({ role: 'assistant', content: textBuf });
      attachAssistantActions(ui.wrap, () => textBuf, conversation.length - 1);
      scheduleChatSave();
    } else {
      conversation.pop();
    }
  }
}

function showUsage(u) {
  const parts = [];
  if (u.input_tokens != null) parts.push(`in ${u.input_tokens}`);
  if (u.output_tokens != null) parts.push(`out ${u.output_tokens}`);
  if (u.cache_read_input_tokens) parts.push(`cache✓ ${u.cache_read_input_tokens}`);
  if (u.cache_creation_input_tokens) parts.push(`cache+ ${u.cache_creation_input_tokens}`);
  if (parts.length) setHint(`tokens: ${parts.join(' · ')}`);
}

// =====================================================================
// AGENT MODE
// =====================================================================

async function runAgentTurn(continuingExisting = false) {
  abortCtrl = new AbortController();
  setStreaming(true);
  await indicatorBroadcast({ type: 'CC_SHOW' });

  // Start trace
  const lastUser = [...conversation].reverse().find((m) => m.role === 'user');
  const promptText = typeof lastUser?.content === 'string' ? lastUser.content
    : (Array.isArray(lastUser?.content) ? lastUser.content.find((c) => c.type === 'text')?.text || '' : '');
  let traceId = null;
  try {
    traceId = await tracesAdapter.start({
      mode: 'agent',
      model: modelSelect.value || settings.defaultModel,
      prompt: promptText,
    });
  } catch {}

  let assistantUI = null;
  let textBuf = '';
  let thinkBuf = '';
  let thinkStream = null;  // single persistent thinking block per turn
  const toolCards = new Map();
  let lastTextBufRef = { value: '' };
  let lastAssistantWrap = null;

  try {
    for await (const ev of runAgent({
      baseUrl: settings.baseUrl, apiToken: settings.apiToken,
      model: modelSelect.value || settings.defaultModel,
      system: settings.systemPrompt, conversation,
      temperature: settings.temperature, maxTokens: settings.maxTokens,
      toolWhitelist, approvalMode: approvalModeVal, askApproval,
      enableCaching: true, cacheTtl: settings.cacheTtl || '5m',
      traceId,
      attachments: lastSentAttachments,
      signal: abortCtrl.signal,
    })) {
      if (ev.kind === 'iteration') {
        if (ev.n > 1) appendIterMarker(ev.n);
        if (ev.n === 1) showStatus('Thinking');
        if (assistantUI && lastTextBufRef.value) {
          const captured = lastTextBufRef.value;
          attachAssistantActions(assistantUI.wrap, () => captured);
        }
        // Start a new batch for this iteration's tool calls
        startNewBatch();
        assistantUI = null;
        textBuf = '';
        // NOTE: don't reset thinkBuf or thinkStream — single live stream per turn
        lastTextBufRef = { value: '' };
        continue;
      }
      if (ev.kind === 'text_delta') {
        if (!assistantUI) { hideStatus(); assistantUI = createAssistantMessage(); lastAssistantWrap = assistantUI.wrap; }
        textBuf += ev.text;
        lastTextBufRef.value = textBuf;
        streamRender(textBuf, assistantUI.body);
        scrollToBottom();
      } else if (ev.kind === 'thinking_delta') {
        if (!thinkStream) thinkStream = createThinkingStream();
        thinkBuf += ev.text;
        // Single-line live ticker — shows current sentence being thought
        setTickerLine(thinkStream, thinkBuf, 'thinking');
        // Also update expanded body so click-to-expand shows full history
        thinkStream.body.textContent = thinkBuf;
        thinkStream.body.scrollTop = thinkStream.body.scrollHeight;
        scrollToBottom();
      } else if (ev.kind === 'tool_call_start') {
        // Update ticker to show current tool action
        if (thinkStream) {
          setTickerLine(thinkStream, statusForTool(ev.name), 'action');
        }
        hideStatus();
        const card = createToolCard(ev.name);
        toolCards.set(ev.id, card);
      } else if (ev.kind === 'tool_call_complete') {
        const c = toolCards.get(ev.id);
        if (c) setToolInput(c, ev.input);
        if (recordingActive) {
          recordedSteps.push({ name: ev.name, input: ev.input, summary: summarizeInput(ev.name, ev.input), ts: Date.now() });
        }
      } else if (ev.kind === 'tool_result') {
        hideStatus();
        const c = toolCards.get(ev.id);
        if (c) setToolResult(c, ev.content, ev.isError, ev.dataUrl);
      } else if (ev.kind === 'usage') {
        showUsage(ev.data);
      } else if (ev.kind === 'error') {
        appendError(ev.message);
        break;
      }
    }
    // Final attach
    if (assistantUI && lastTextBufRef.value) {
      const captured = lastTextBufRef.value;
      attachAssistantActions(assistantUI.wrap, () => captured);
    }
    // Mark ticker as done — auto-fade and remove from DOM so it doesn't
    // leave a permanent ghost row taking vertical space after completion.
    if (thinkStream) {
      setTickerLine(thinkStream, 'Done', 'idle');
      thinkStream.wrap.classList.add('done');
      const tickerEl = thinkStream.wrap;
      setTimeout(() => {
        if (!tickerEl.isConnected) return;
        tickerEl.classList.add('fading-out');
        setTimeout(() => { try { tickerEl.remove(); } catch {} }, 320);
      }, 1200);
    }
  } catch (e) {
    appendError(`Unexpected: ${e.message}`);
  } finally {
    hideStatus();
    finalizeBatch();
    setStreaming(false);
    abortCtrl = null;
    await indicatorBroadcast({ type: 'CC_HIDE' });
    scheduleChatSave();
    if (traceId) tracesAdapter.finish(traceId, abortCtrl?.signal?.aborted ? 'aborted' : 'completed').catch(() => {});
  }
}

async function sendAgent(userText, userContent, attachments = []) {
  conversation.push({ role: 'user', content: userContent });
  // Snapshot for chat-attachment tools (list_chat_attachments / get_chat_attachment / upload_image)
  lastSentAttachments = attachments.map((a) => ({
    name: a.name, mime: a.mime, size: a.size, kind: a.kind,
    base64: a.base64 || '', text: a.text || '',
  }));
  await runAgentTurn();
}

async function send() {
  const text = inputEl.value.trim();
  if (!text && pendingAttachments.length === 0) return;
  if (!settings.apiToken) {
    appendError('No API token configured. Open Settings (⋯ → Settings) first.');
    return;
  }

  // Snapshot attachments for this send
  const attachments = pendingAttachments.slice();
  const userContent = buildUserContent(text, attachments);

  appendUserMessage(text, true, attachments);
  inputEl.value = '';
  clearPendingAttachments();
  autoResize();

  if (mode === 'agent') await sendAgent(text, userContent, attachments);
  else await sendChat(text, userContent);
}

function stopStreaming() { abortCtrl?.abort(); }

// =====================================================================
// Attachments
// =====================================================================

function renderAttachments() {
  attachmentRow.replaceChildren();
  if (!pendingAttachments.length) {
    attachmentRow.classList.add('hidden');
    return;
  }
  attachmentRow.classList.remove('hidden');
  for (const a of pendingAttachments) {
    const chip = document.createElement('div');
    chip.className = 'att-chip';

    if (a.kind === 'image' && a.dataUrl) {
      const img = document.createElement('img');
      img.className = 'att-chip-thumb';
      img.src = a.dataUrl;
      img.alt = a.name;
      chip.appendChild(img);
    } else {
      const ic = document.createElement('span');
      ic.className = 'att-chip-icon';
      ic.textContent = kindIcon(a.kind);
      chip.appendChild(ic);
    }

    const info = document.createElement('div');
    info.className = 'att-chip-info';
    const name = document.createElement('span');
    name.className = 'att-chip-name';
    name.textContent = a.name;
    name.title = a.name;
    const meta = document.createElement('span');
    meta.className = 'att-chip-meta';
    const kb = a.size > 1024 ? (a.size / 1024).toFixed(1) + ' KB' : a.size + ' B';
    meta.textContent = `${a.kind}${a.truncated ? ' · truncated' : ''} · ${kb}`;
    info.appendChild(name);
    info.appendChild(meta);
    chip.appendChild(info);

    const remove = document.createElement('button');
    remove.className = 'att-chip-remove';
    remove.textContent = '✕';
    remove.title = 'Remove';
    remove.addEventListener('click', () => {
      pendingAttachments = pendingAttachments.filter((x) => x.id !== a.id);
      renderAttachments();
    });
    chip.appendChild(remove);

    attachmentRow.appendChild(chip);
  }
}

function clearPendingAttachments() {
  pendingAttachments = [];
  renderAttachments();
}

async function ingestFiles(fileList) {
  if (!fileList || !fileList.length) return;
  const errors = [];
  for (const file of fileList) {
    try {
      const att = await readFile(file);
      pendingAttachments.push(att);
    } catch (e) {
      errors.push(e.message || String(e));
    }
  }
  renderAttachments();
  if (errors.length) setHint(errors.join(' · '));
}

function newChat() {
  conversation = [];
  currentChatId = null;
  renderEmptyState();
  inputEl.focus();
  closeHistory();
}

// =====================================================================
// Library drawer (memory / KB / prompts / scheduled)
// =====================================================================

function openLibrary(tab) {
  if (tab) libTab = tab;
  libDrawer.classList.remove('hidden');
  toolsDrawer.classList.add('hidden');
  recDrawer.classList.add('hidden');
  for (const t of libTabs) t.classList.toggle('active', t.dataset.tab === libTab);
  renderLibrary();
}

async function renderLibrary() {
  libBody.replaceChildren();
  if (libTab === 'memory') return renderMemoryTab();
  if (libTab === 'kb') return renderKbTab();
  if (libTab === 'prompts') return renderPromptsTab();
  if (libTab === 'scheduled') return renderScheduledTab();
  if (libTab === 'traces') return renderTracesTab();
}

async function renderMemoryTab() {
  const items = await memoryAdapter.list();
  if (!items.length) appendLibEmpty('No memories yet. Type "remember X" to the agent or click below.');
  for (const m of items) {
    const row = document.createElement('div');
    row.className = 'lib-row';
    const info = document.createElement('div');
    info.className = 'lib-info';
    const t = document.createElement('div');
    t.className = 'lib-title';
    t.textContent = m.fact;
    const meta = document.createElement('div');
    meta.className = 'lib-meta';
    meta.textContent = `${m.category} · ${formatDate(m.createdAt)}`;
    info.appendChild(t); info.appendChild(meta);
    const del = document.createElement('button');
    del.className = 'ghost-mini';
    del.textContent = '✕';
    del.addEventListener('click', async () => { await memoryAdapter.remove(m.id); renderMemoryTab(); });
    row.appendChild(info); row.appendChild(del);
    libBody.appendChild(row);
  }
  const add = document.createElement('button');
  add.className = 'lib-add';
  add.textContent = '+ Add memory';
  add.addEventListener('click', async () => {
    const fact = prompt('Memory (a fact about you the agent should remember):');
    if (!fact) return;
    const cat = prompt('Category (e.g. profile, preference, project):', 'general') || 'general';
    await memoryAdapter.add(fact, cat);
    renderMemoryTab();
  });
  libBody.appendChild(add);
}

async function renderKbTab() {
  const items = await kbAdapter.list();
  if (!items.length) appendLibEmpty('No KB files. Click + to upload reusable context.');
  for (const f of items) {
    const row = document.createElement('div');
    row.className = 'lib-row';
    const info = document.createElement('div');
    info.className = 'lib-info';
    const t = document.createElement('div');
    t.className = 'lib-title';
    t.textContent = `${kindIcon(f.kind)} ${f.name}`;
    const meta = document.createElement('div');
    meta.className = 'lib-meta';
    meta.textContent = `${f.kind} · ${(f.size / 1024).toFixed(1)} KB`;
    info.appendChild(t); info.appendChild(meta);
    const del = document.createElement('button');
    del.className = 'ghost-mini';
    del.textContent = '✕';
    del.addEventListener('click', async () => { await kbAdapter.remove(f.id); renderKbTab(); });
    row.appendChild(info); row.appendChild(del);
    libBody.appendChild(row);
  }
  const add = document.createElement('button');
  add.className = 'lib-add';
  add.textContent = '+ Upload to KB';
  add.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'text/*,.md,.json,.csv,.tsv,.xml,.yaml,.yml,.toml,.js,.ts,.py,.html,.log';
    inp.addEventListener('change', async () => {
      for (const file of inp.files || []) {
        try {
          const att = await readFile(file);
          if (att.kind !== 'text') {
            setHint(`Only text files supported in KB. Got: ${att.kind}`);
            continue;
          }
          await kbAdapter.add({ name: att.name, kind: att.kind, size: att.size, text: att.text });
        } catch (e) { setHint(e.message); }
      }
      renderKbTab();
    });
    inp.click();
  });
  libBody.appendChild(add);
}

async function renderPromptsTab() {
  const items = await promptsAdapter.list();
  for (const p of items) {
    const row = document.createElement('div');
    row.className = 'lib-row';
    const info = document.createElement('div');
    info.className = 'lib-info';
    const t = document.createElement('div');
    t.className = 'lib-title';
    t.innerHTML = `<code style="background:var(--accent-soft);color:var(--accent);padding:1px 5px;border-radius:3px;font-size:11px;margin-right:6px;">/${p.slash}</code>${p.name}`;
    const meta = document.createElement('div');
    meta.className = 'lib-meta';
    meta.textContent = `${p.mode} · ${p.body.slice(0, 60)}…`;
    info.appendChild(t); info.appendChild(meta);
    const use = document.createElement('button');
    use.className = 'ghost-mini';
    use.textContent = 'Use';
    use.addEventListener('click', () => {
      inputEl.value = p.body;
      autoResize();
      libDrawer.classList.add('hidden');
      inputEl.focus();
    });
    const del = document.createElement('button');
    del.className = 'ghost-mini';
    del.textContent = '✕';
    del.addEventListener('click', async () => { await promptsAdapter.remove(p.id); renderPromptsTab(); });
    row.appendChild(info); row.appendChild(use); row.appendChild(del);
    libBody.appendChild(row);
  }
  const add = document.createElement('button');
  add.className = 'lib-add';
  add.textContent = '+ Add prompt';
  add.addEventListener('click', async () => {
    const name = prompt('Prompt name:'); if (!name) return;
    const slash = prompt('Slash trigger (no /, alphanumeric):', name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (!slash) return;
    const body = prompt('Prompt body:'); if (!body) return;
    await promptsAdapter.add({ name, slash, body, mode: 'any' });
    renderPromptsTab();
  });
  libBody.appendChild(add);
}

async function renderScheduledTab() {
  const items = await scheduledAdapter.list();
  if (!items.length) appendLibEmpty('No scheduled tasks. Click + to add a recurring prompt.');
  for (const s of items) {
    const row = document.createElement('div');
    row.className = 'lib-row';
    const info = document.createElement('div');
    info.className = 'lib-info';
    const t = document.createElement('div');
    t.className = 'lib-title';
    t.textContent = `${s.enabled ? '✓' : '✕'} ${s.name}`;
    const meta = document.createElement('div');
    meta.className = 'lib-meta';
    meta.textContent = `${s.schedule} · next: ${s.nextRunAt ? formatDate(s.nextRunAt) : '-'}`;
    info.appendChild(t); info.appendChild(meta);
    const tog = document.createElement('button');
    tog.className = 'ghost-mini';
    tog.textContent = s.enabled ? 'Pause' : 'Resume';
    tog.addEventListener('click', async () => { await scheduledAdapter.toggle(s.id, !s.enabled); renderScheduledTab(); });
    const del = document.createElement('button');
    del.className = 'ghost-mini';
    del.textContent = '✕';
    del.addEventListener('click', async () => { await scheduledAdapter.remove(s.id); renderScheduledTab(); });
    row.appendChild(info); row.appendChild(tog); row.appendChild(del);
    libBody.appendChild(row);
  }
  const add = document.createElement('button');
  add.className = 'lib-add';
  add.textContent = '+ Schedule task';
  add.addEventListener('click', async () => {
    const name = prompt('Task name:'); if (!name) return;
    const promptText = prompt('Prompt to run:'); if (!promptText) return;
    const schedule = prompt('Schedule (once, hourly, daily, weekly):', 'daily') || 'daily';
    const modeS = prompt('Mode (chat or agent):', 'agent') || 'agent';
    await scheduledAdapter.add({ name, prompt: promptText, mode: modeS, schedule });
    renderScheduledTab();
  });
  libBody.appendChild(add);
}

function appendLibEmpty(text) {
  const e = document.createElement('div');
  e.className = 'lib-empty';
  e.textContent = text;
  libBody.appendChild(e);
}

async function renderTracesTab() {
  const items = await tracesAdapter.list();
  if (!items.length) { appendLibEmpty('No traces yet. Run an agent task — every tool call is auto-recorded.'); return; }
  for (const t of items) {
    const row = document.createElement('div');
    row.className = 'lib-row';
    const info = document.createElement('div');
    info.className = 'lib-info';
    const title = document.createElement('div');
    title.className = 'lib-title';
    const dur = t.endedAt ? Math.max(0, Math.round((t.endedAt - t.startedAt) / 1000)) + 's' : '…';
    title.textContent = `${t.prompt || '(no prompt)'} `;
    const meta = document.createElement('div');
    meta.className = 'lib-meta';
    meta.textContent = `${t.stepCount} steps · ${dur} · ${formatDate(t.startedAt)} · ${t.status}`;
    info.appendChild(title);
    info.appendChild(meta);
    const view = document.createElement('button');
    view.className = 'ghost-mini';
    view.textContent = 'View';
    view.addEventListener('click', () => viewTrace(t.id));
    const del = document.createElement('button');
    del.className = 'ghost-mini';
    del.textContent = '✕';
    del.addEventListener('click', async () => { await tracesAdapter.remove(t.id); renderTracesTab(); });
    row.appendChild(info); row.appendChild(view); row.appendChild(del);
    libBody.appendChild(row);
  }
  const clearAll = document.createElement('button');
  clearAll.className = 'lib-add';
  clearAll.textContent = '🗑 Clear all traces';
  clearAll.addEventListener('click', async () => {
    if (confirm('Delete ALL traces?')) { await tracesAdapter.clear(); renderTracesTab(); }
  });
  libBody.appendChild(clearAll);
}

async function viewTrace(id) {
  const t = await tracesAdapter.get(id);
  if (!t) return;
  // Render trace timeline as a chat-like view in messages area
  conversation = [];
  currentChatId = null;
  messagesEl.replaceChildren();
  ensureNoEmpty();
  // Header
  const hdr = document.createElement('div');
  hdr.className = 'iter-marker';
  hdr.style.cssText = 'display:block;font-weight:600;color:var(--text);font-size:13px;margin:8px 0;';
  hdr.textContent = `📼 Trace · ${t.prompt} · ${t.steps.length} steps`;
  messagesEl.appendChild(hdr);

  appendUserMessage(t.prompt || '(no prompt)');

  for (const s of t.steps) {
    const card = createToolCard(s.name);
    setToolInput(card, s.input || {});
    setToolResult(card, s.content, s.isError, s.dataUrl);
  }
  libDrawer.classList.add('hidden');
  scrollToBottom(true);
}

// =====================================================================
// Slash command autocomplete
// =====================================================================

let slashSelected = 0;
let slashItems = [];

async function updateSlashPop() {
  const text = inputEl.value;
  const m = text.match(/^\/(\w*)$/);
  if (!m) { slashPop.classList.add('hidden'); return; }
  const matches = await promptsAdapter.matchSlash(m[1]);
  if (!matches.length) { slashPop.classList.add('hidden'); return; }
  slashItems = matches;
  slashSelected = 0;
  slashPop.replaceChildren();
  for (let i = 0; i < matches.length; i++) {
    const p = matches[i];
    const item = document.createElement('div');
    item.className = 'slash-item' + (i === 0 ? ' selected' : '');
    const code = document.createElement('code');
    code.textContent = '/' + p.slash;
    const name = document.createElement('span');
    name.className = 'slash-name';
    name.textContent = p.name;
    const body = document.createElement('span');
    body.className = 'slash-body';
    body.textContent = p.body.replace(/\s+/g, ' ').slice(0, 50);
    item.appendChild(code); item.appendChild(name); item.appendChild(body);
    item.addEventListener('click', () => insertSlashPrompt(p));
    slashPop.appendChild(item);
  }
  slashPop.classList.remove('hidden');
}

function insertSlashPrompt(p) {
  inputEl.value = p.body;
  slashPop.classList.add('hidden');
  autoResize();
  inputEl.focus();
}

async function deleteCurrentChat() {
  if (!currentChatId) { newChat(); return; }
  if (!confirm('Delete this chat?')) return;
  savedChats = savedChats.filter((c) => c.id !== currentChatId);
  await persistChats();
  newChat();
}

function exportCurrentChat() {
  if (!conversation.length) return;
  const lines = [];
  for (const m of conversation) {
    if (m.role === 'user') {
      const text = typeof m.content === 'string' ? m.content
        : (Array.isArray(m.content) ? m.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n') : '');
      if (text) lines.push(`## User\n\n${text}\n`);
    } else if (m.role === 'assistant') {
      const text = typeof m.content === 'string' ? m.content
        : (Array.isArray(m.content) ? m.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n') : '');
      if (text) lines.push(`## Assistant\n\n${text}\n`);
    }
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// =====================================================================
// Wiring
// =====================================================================

sendBtn.addEventListener('click', send);
stopBtn.addEventListener('click', stopStreaming);
newChatBtn.addEventListener('click', newChat);
historyBtn.addEventListener('click', () => historyPanel.classList.contains('hidden') ? openHistory() : closeHistory());
historyClose.addEventListener('click', closeHistory);
historySearch.addEventListener('input', (e) => renderHistory(e.target.value));
modeChatBtn.addEventListener('click', () => setMode('chat'));
modeAgentBtn.addEventListener('click', () => setMode('agent'));

// Overflow menu
overflowBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  overflowMenu.classList.toggle('hidden');
});
document.addEventListener('click', (e) => {
  if (!overflowMenu.contains(e.target) && e.target !== overflowBtn) overflowMenu.classList.add('hidden');
});
ovTools.addEventListener('click', () => {
  overflowMenu.classList.add('hidden');
  recDrawer.classList.add('hidden');
  libDrawer.classList.add('hidden');
  toolsDrawer.classList.toggle('hidden');
  if (!toolsDrawer.classList.contains('hidden')) renderToolsList();
});
ovLib.addEventListener('click', () => {
  overflowMenu.classList.add('hidden');
  openLibrary(libTab);
});
ovRec.addEventListener('click', () => {
  overflowMenu.classList.add('hidden');
  toolsDrawer.classList.add('hidden');
  libDrawer.classList.add('hidden');
  recDrawer.classList.toggle('hidden');
  if (!recDrawer.classList.contains('hidden')) renderRecList();
});
ovExport.addEventListener('click', () => { overflowMenu.classList.add('hidden'); exportCurrentChat(); });
ovDelete.addEventListener('click', () => { overflowMenu.classList.add('hidden'); deleteCurrentChat(); });
ovSettings.addEventListener('click', () => { overflowMenu.classList.add('hidden'); chrome.runtime.openOptionsPage(); });

// Drawers
toolsCloseBtn.addEventListener('click', () => toolsDrawer.classList.add('hidden'));
toolsAllBtn.addEventListener('click', () => setAllTools(true));
toolsNoneBtn.addEventListener('click', () => setAllTools(false));
approvalModeSel.addEventListener('change', () => {
  approvalModeVal = approvalModeSel.value;
  saveAgentPrefs();
});
recCloseBtn.addEventListener('click', () => recDrawer.classList.add('hidden'));
recRecord.addEventListener('click', () => {
  if (recordingActive) stopRecordingAndSave();
  else startRecording();
});

// Library
libClose.addEventListener('click', () => libDrawer.classList.add('hidden'));
for (const t of libTabs) {
  t.addEventListener('click', () => {
    libTab = t.dataset.tab;
    for (const x of libTabs) x.classList.toggle('active', x === t);
    renderLibrary();
  });
}

// Jump-to-latest pill + scroll-up detection
jumpPill.addEventListener('click', forceScrollToBottom);
messagesEl.addEventListener('scroll', () => {
  if (_programmaticScroll) return;  // ignore our own scrolls
  const distanceFromBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
  // User manually scrolled up if more than ~10px away (small tolerance)
  if (distanceFromBottom > 40) {
    userScrolledUp = true;
    jumpPill.classList.add('show');
  } else {
    // User scrolled back to bottom — re-enable auto-follow
    userScrolledUp = false;
    jumpPill.classList.remove('show');
  }
});

inputEl.addEventListener('keydown', (e) => {
  // Slash autocomplete navigation
  if (!slashPop.classList.contains('hidden') && slashItems.length) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      slashSelected = (slashSelected + (e.key === 'ArrowDown' ? 1 : -1) + slashItems.length) % slashItems.length;
      const els = slashPop.querySelectorAll('.slash-item');
      els.forEach((el, i) => el.classList.toggle('selected', i === slashSelected));
      return;
    }
    if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      insertSlashPrompt(slashItems[slashSelected]);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      slashPop.classList.add('hidden');
      return;
    }
  }

  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    send();
  }
});
inputEl.addEventListener('input', () => { autoResize(); updateSlashPop(); });

// Paste image from clipboard
inputEl.addEventListener('paste', async (e) => {
  const items = e.clipboardData?.items || [];
  const files = [];
  for (const item of items) {
    if (item.kind === 'file') {
      const f = item.getAsFile();
      if (f) files.push(f);
    }
  }
  if (files.length) {
    e.preventDefault();
    await ingestFiles(files);
  }
});

// File picker
attachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
  await ingestFiles(e.target.files);
  fileInput.value = '';
});

// Drag & drop on entire body
let dragDepth = 0;document.body.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer?.types?.includes('Files')) return;
  e.preventDefault();
  dragDepth++;
  dropOverlay.classList.remove('hidden');
});
document.body.addEventListener('dragover', (e) => {
  if (!e.dataTransfer?.types?.includes('Files')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
document.body.addEventListener('dragleave', (e) => {
  dragDepth--;
  if (dragDepth <= 0) { dragDepth = 0; dropOverlay.classList.add('hidden'); }
});
document.body.addEventListener('drop', async (e) => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault();
  dragDepth = 0;
  dropOverlay.classList.add('hidden');
  await ingestFiles(e.dataTransfer.files);
});

modelSelect.addEventListener('change', () => {
  settings.defaultModel = modelSelect.value;
  safeStorageSet({ settings });
  // Switch to manual since user picked specifically
  if (speedSelect.value !== 'manual') speedSelect.value = 'manual';
});

// Speed preset → model mapping
const SPEED_MODELS = {
  fast: 'kr/claude-haiku-4.5',
  balanced: 'kr/claude-sonnet-4.5',
  quality: 'kr/claude-opus-4.7',
};

function applySpeedPreset(preset) {
  if (preset === 'manual') return;
  const target = SPEED_MODELS[preset];
  if (!target) return;
  let opt = [...modelSelect.options].find((o) => o.value === target);
  if (!opt) {
    const partial = target.split('/').pop();
    opt = [...modelSelect.options].find((o) => o.value.includes(partial));
  }
  if (opt) {
    modelSelect.value = opt.value;
    settings.defaultModel = opt.value;
    safeStorageSet({ settings });
  }
}

speedSelect.addEventListener('change', () => {
  applySpeedPreset(speedSelect.value);
  safeStorageSet({ speedPreset: speedSelect.value });
});

// =====================================================================
// MCP bridge (Claude Code integration)
// =====================================================================

const CLI_TITLES = {
  disconnected: 'Claude Code bridge — disconnected. Click to connect.',
  connecting: 'Claude Code bridge — connecting…',
  connected: 'Claude Code bridge — connected. Click to disconnect.',
};

function setCliStatus(status) {
  cliBtn.dataset.status = status;
  cliBtn.title = CLI_TITLES[status] || status;
  // Persist user intent (auto-reconnect next session)
  if (status === 'connected') safeStorageSet({ mcpEnabled: true });
}

mcpClient.onStatus = setCliStatus;
setCliStatus('disconnected');

cliBtn.addEventListener('click', async () => {
  if (mcpClient.status === 'disconnected') {
    setHint('Connecting to Claude Code bridge on ws://127.0.0.1:9777…');
    mcpClient.connect();
  } else {
    mcpClient.disconnect();
    await safeStorageSet({ mcpEnabled: false });
    setHint('Disconnected from Claude Code bridge.');
  }
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) { settings = changes.settings.newValue; await loadModelList(); }
  if (changes.chats) savedChats = changes.chats.newValue || [];
});

// Init
(async () => {
  await loadSettings();
  await loadModelList();
  // Restore speed preset
  const { speedPreset } = await chrome.storage.local.get(['speedPreset']);
  if (speedPreset && SPEED_MODELS[speedPreset]) {
    speedSelect.value = speedPreset;
    applySpeedPreset(speedPreset);
  } else if (speedPreset === 'manual') {
    speedSelect.value = 'manual';
  }
  renderEmptyState();
  inputEl.focus();
  // Pick up scheduled task if pending
  await runPendingScheduledIfAny();
  // Pre-warm cache in background (best-effort, no-op on error)
  prewarmCache();
  // Auto-reconnect MCP bridge if user previously enabled it
  const { mcpEnabled } = await chrome.storage.local.get(['mcpEnabled']);
  if (mcpEnabled) mcpClient.connect();
})();

// Pre-warm prompt cache: send max_tokens:0 with system+tools so the next
// real request hits the cache. Runs once per session, fire-and-forget.
async function prewarmCache() {
  if (!settings.apiToken) return;
  if (window.__cc_prewarmed__) return;
  window.__cc_prewarmed__ = true;
  try {
    const url = settings.baseUrl.replace(/\/$/, '') + '/messages';
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiToken}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelSelect.value || settings.defaultModel,
        max_tokens: 1,
        stream: false,
        system: [{ type: 'text', text: 'warmup', cache_control: { type: 'ephemeral', ttl: settings.cacheTtl || '5m' } }],
        messages: [{ role: 'user', content: 'ok' }],
      }),
    });
  } catch {}
}

async function runPendingScheduledIfAny() {
  const { pendingScheduled } = await chrome.storage.local.get(['pendingScheduled']);
  if (!pendingScheduled) return;
  // Only consume if recent (< 60s)
  if (Date.now() - (pendingScheduled.ts || 0) > 60000) {
    await chrome.storage.local.remove(['pendingScheduled']);
    return;
  }
  await chrome.storage.local.remove(['pendingScheduled']);
  setMode(pendingScheduled.mode === 'agent' ? 'agent' : 'chat');
  if (pendingScheduled.model) {
    const found = [...modelSelect.options].find((o) => o.value === pendingScheduled.model);
    if (found) modelSelect.value = pendingScheduled.model;
  }
  inputEl.value = pendingScheduled.prompt;
  autoResize();
  setHint(`▶ Running scheduled task`);
  setTimeout(() => send(), 500);
}
