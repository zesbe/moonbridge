// Traces: auto-record every tool call so the user can replay and audit.
// Storage: chrome.storage.local 'traces' (capped to last 50)
//
// Trace shape:
//   {
//     id, startedAt, endedAt, mode, model, prompt, status,
//     steps: [{ ts, name, input, content, isError, dataUrl?, durationMs }]
//   }

const KEY = 'traces';
const MAX_TRACES = 50;
const MAX_STEP_CONTENT = 4000;
const MAX_DATAURL = 200_000; // cap embedded image size to keep storage sane

export const tracesAdapter = {
  async list() {
    const { [KEY]: m } = await chrome.storage.local.get([KEY]);
    if (!Array.isArray(m)) return [];
    // Strip steps for list view
    return m.map((t) => ({
      id: t.id, startedAt: t.startedAt, endedAt: t.endedAt,
      mode: t.mode, model: t.model, prompt: t.prompt, status: t.status,
      stepCount: (t.steps || []).length,
    }));
  },
  async get(id) {
    const { [KEY]: m } = await chrome.storage.local.get([KEY]);
    if (!Array.isArray(m)) return null;
    return m.find((t) => t.id === id) || null;
  },
  async start({ mode, model, prompt }) {
    const traces = await listFull();
    const id = 'tr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const trace = {
      id, mode, model, prompt: (prompt || '').slice(0, 200),
      startedAt: Date.now(), endedAt: null, status: 'running',
      steps: [],
    };
    traces.unshift(trace);
    while (traces.length > MAX_TRACES) traces.pop();
    await chrome.storage.local.set({ [KEY]: traces });
    return id;
  },
  async addStep(id, step) {
    const traces = await listFull();
    const t = traces.find((x) => x.id === id);
    if (!t) return;
    let content = step.content;
    if (typeof content === 'string') content = content.slice(0, MAX_STEP_CONTENT);
    else if (Array.isArray(content)) {
      content = content.map((c) => {
        if (c.type === 'text') return { ...c, text: (c.text || '').slice(0, MAX_STEP_CONTENT) };
        return c;
      });
    }
    let dataUrl = step.dataUrl;
    if (dataUrl && dataUrl.length > MAX_DATAURL) dataUrl = null;
    t.steps.push({
      ts: Date.now(),
      name: step.name,
      input: step.input,
      content,
      isError: !!step.isError,
      dataUrl,
      durationMs: step.durationMs ?? null,
    });
    await chrome.storage.local.set({ [KEY]: traces });
  },
  async finish(id, status = 'completed') {
    const traces = await listFull();
    const t = traces.find((x) => x.id === id);
    if (!t) return;
    t.endedAt = Date.now();
    t.status = status;
    await chrome.storage.local.set({ [KEY]: traces });
  },
  async remove(id) {
    const traces = await listFull();
    const next = traces.filter((t) => t.id !== id);
    if (next.length === traces.length) return false;
    await chrome.storage.local.set({ [KEY]: next });
    return true;
  },
  async clear() { await chrome.storage.local.set({ [KEY]: [] }); },
};

async function listFull() {
  const { [KEY]: m } = await chrome.storage.local.get([KEY]);
  return Array.isArray(m) ? m : [];
}
