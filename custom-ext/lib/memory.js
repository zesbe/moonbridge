// Persistent memory: stores user facts that get auto-injected into the system prompt.
// Storage: chrome.storage.local under key 'memories'.
//
// Memory shape: { id, fact, category, createdAt }

const KEY = 'memories';

export const memoryAdapter = {
  async list() {
    const { [KEY]: m } = await chrome.storage.local.get([KEY]);
    return Array.isArray(m) ? m : [];
  },
  async add(fact, category = 'general') {
    const items = await this.list();
    const id = 'mem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    items.push({ id, fact, category, createdAt: Date.now() });
    await chrome.storage.local.set({ [KEY]: items });
    return id;
  },
  async remove(id) {
    const items = await this.list();
    const next = items.filter((m) => m.id !== id);
    if (next.length === items.length) return false;
    await chrome.storage.local.set({ [KEY]: next });
    return true;
  },
  async clear() {
    await chrome.storage.local.set({ [KEY]: [] });
  },
  // Renders memories as a system prompt section. Returns '' if none.
  async renderForSystem() {
    const items = await this.list();
    if (!items.length) return '';
    const grouped = {};
    for (const m of items) {
      const cat = m.category || 'general';
      (grouped[cat] = grouped[cat] || []).push(m);
    }
    const lines = ['# Persistent context about the user'];
    for (const cat of Object.keys(grouped)) {
      lines.push(`\n## ${cat}`);
      for (const m of grouped[cat]) lines.push(`- ${m.fact}`);
    }
    return lines.join('\n');
  },
};
