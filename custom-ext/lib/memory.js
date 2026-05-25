// Persistent memory: stores user facts that get auto-injected into the system prompt.
// Storage: chrome.storage.local under key 'memories'.
//
// Memory shape: { id, fact, category, createdAt }
//
// v2.3: write transaction queue prevents race conditions when parallel
// remember() calls clobber each other (read-modify-write hazard).

const KEY = 'memories';

// Serialize all writes through a promise chain (mutex pattern).
// Reads still go through chrome.storage directly — only mutations queue.
let _writeChain = Promise.resolve();
function withWriteLock(fn) {
  const next = _writeChain.then(fn, fn);
  // Don't propagate errors to subsequent calls; each owns its own catch
  _writeChain = next.catch(() => {});
  return next;
}

export const memoryAdapter = {
  async list() {
    const { [KEY]: m } = await chrome.storage.local.get([KEY]);
    return Array.isArray(m) ? m : [];
  },
  async add(fact, category = 'general') {
    return withWriteLock(async () => {
      const items = await this.list();
      const id = 'mem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      items.push({ id, fact, category, createdAt: Date.now() });
      await chrome.storage.local.set({ [KEY]: items });
      return id;
    });
  },
  async remove(id) {
    return withWriteLock(async () => {
      const items = await this.list();
      const next = items.filter((m) => m.id !== id);
      if (next.length === items.length) return false;
      await chrome.storage.local.set({ [KEY]: next });
      return true;
    });
  },
  async clear() {
    return withWriteLock(async () => {
      await chrome.storage.local.set({ [KEY]: [] });
    });
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
