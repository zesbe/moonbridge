// Saved prompt templates - quick-insert via slash command in input.
// Storage: chrome.storage.local 'prompts'
//
// Prompt shape: { id, name, slash, body, mode, createdAt }
//   slash: short trigger like "/summarize" (without leading /, alphanumeric+dash+_)
//   mode: 'chat' | 'agent' | 'any'

const KEY = 'prompts';

const DEFAULTS = [
  { id: 'p_summarize', name: 'Summarize page', slash: 'summarize', body: 'Summarize this page in 5 bullets, then list 3 follow-up questions.', mode: 'agent', createdAt: 0 },
  { id: 'p_translate', name: 'Translate to ID', slash: 'id', body: 'Translate the following to natural Indonesian. Preserve formatting and code blocks.\n\n', mode: 'chat', createdAt: 0 },
  { id: 'p_review', name: 'Code review', slash: 'review', body: 'Review the code I just shared. Flag bugs, security issues, and suggest concrete improvements with code samples.', mode: 'chat', createdAt: 0 },
  { id: 'p_extract', name: 'Extract structured', slash: 'extract', body: 'Extract structured data from this page (use get_page first). Output as JSON.', mode: 'agent', createdAt: 0 },
];

export const promptsAdapter = {
  async list() {
    const { [KEY]: m } = await chrome.storage.local.get([KEY]);
    if (!Array.isArray(m)) {
      // Seed defaults on first run
      await chrome.storage.local.set({ [KEY]: DEFAULTS });
      return DEFAULTS;
    }
    return m;
  },
  async add({ name, slash, body, mode = 'any' }) {
    const items = await this.list();
    const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const cleanSlash = (slash || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    items.push({ id, name, slash: cleanSlash, body, mode, createdAt: Date.now() });
    await chrome.storage.local.set({ [KEY]: items });
    return id;
  },
  async update(id, patch) {
    const items = await this.list();
    const idx = items.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    items[idx] = { ...items[idx], ...patch };
    await chrome.storage.local.set({ [KEY]: items });
    return true;
  },
  async remove(id) {
    const items = await this.list();
    const next = items.filter((p) => p.id !== id);
    if (next.length === items.length) return false;
    await chrome.storage.local.set({ [KEY]: next });
    return true;
  },
  // Match slash typed in input (e.g. "/sum" matches "/summarize")
  async matchSlash(prefix) {
    if (!prefix) return [];
    const p = prefix.toLowerCase();
    const items = await this.list();
    return items.filter((x) => x.slash.startsWith(p)).slice(0, 8);
  },
};
