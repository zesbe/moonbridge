// Knowledge base: persistent files that can be searched and embedded as context.
// Naive in-memory search (substring match with surrounding excerpt).
//
// File shape: { id, name, kind, size, text, createdAt }
// Kept under chrome.storage.local 'kb' (text-only — images/pdfs are pre-extracted to text).

const KEY = 'kb';

export const kbAdapter = {
  async list() {
    const { [KEY]: m } = await chrome.storage.local.get([KEY]);
    if (!Array.isArray(m)) return [];
    // Strip text from list view
    return m.map((f) => ({ id: f.id, name: f.name, kind: f.kind, size: f.size, createdAt: f.createdAt }));
  },
  async listFull() {
    const { [KEY]: m } = await chrome.storage.local.get([KEY]);
    return Array.isArray(m) ? m : [];
  },
  async add({ name, kind, size, text }) {
    const items = await this.listFull();
    const id = 'kb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    items.push({ id, name, kind, size, text: text || '', createdAt: Date.now() });
    await chrome.storage.local.set({ [KEY]: items });
    return id;
  },
  async remove(id) {
    const items = await this.listFull();
    const next = items.filter((f) => f.id !== id);
    if (next.length === items.length) return false;
    await chrome.storage.local.set({ [KEY]: next });
    return true;
  },
  async clear() { await chrome.storage.local.set({ [KEY]: [] }); },
  async search(query, limit = 5) {
    const items = await this.listFull();
    if (!query || !items.length) return [];
    const q = query.toLowerCase();
    const matches = [];
    for (const f of items) {
      const text = (f.text || '').toLowerCase();
      const idx = text.indexOf(q);
      if (idx < 0) continue;
      const start = Math.max(0, idx - 200);
      const end = Math.min(f.text.length, idx + 600);
      const excerpt = (start > 0 ? '…' : '') + f.text.slice(start, end) + (end < f.text.length ? '…' : '');
      matches.push({ id: f.id, name: f.name, kind: f.kind, excerpt, hitIndex: idx });
      if (matches.length >= limit) break;
    }
    return matches;
  },
};
