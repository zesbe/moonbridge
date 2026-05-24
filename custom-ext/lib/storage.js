// =====================================================================
// MoonBridge — production storage layer
// =====================================================================
// chrome.storage.local has a 10MB hard quota. Saving raw conversations
// with screenshots / base64 / dataUrl in there will blow up with:
//   "Resource:kQuotaBytes quota exceeded"
//
// This module enforces:
//   1. sanitizeForStorage() — strips heavy fields before persist
//   2. safeStorageSet() — quota-aware writes with auto-trim + retry
//   3. IndexedDB blob store — one place for screenshots/attachments
//   4. debounce() — coalesce noisy writes
//   5. logger — leveled, DEBUG-toggle, replaces raw console.*
// =====================================================================

// ---------- Logger ----------
// Toggle DEBUG via:   localStorage.setItem('mb_debug', '1')
// Or programmatically: logger.setDebug(true)
const _LOG_PREFIX = '[MB]';
let _debug = false;
try { _debug = localStorage.getItem('mb_debug') === '1'; } catch {}

export const logger = {
  setDebug(on) {
    _debug = !!on;
    try { localStorage.setItem('mb_debug', _debug ? '1' : '0'); } catch {}
  },
  debug(...args) { if (_debug) console.log(_LOG_PREFIX, ...args); },
  info(...args)  { console.log(_LOG_PREFIX, ...args); },
  warn(...args)  { console.warn(_LOG_PREFIX, ...args); },
  error(...args) { console.error(_LOG_PREFIX, ...args); },
};

// ---------- Helpers ----------
export function debounce(fn, ms = 800) {
  let t = null;
  let lastResolve = null;
  const wrapped = function (...args) {
    if (t) clearTimeout(t);
    return new Promise((resolve) => {
      lastResolve = resolve;
      t = setTimeout(async () => {
        t = null;
        try { resolve(await fn.apply(this, args)); }
        catch (e) { logger.error('debounced fn threw', e); resolve(undefined); }
      }, ms);
    });
  };
  wrapped.flush = async function (...args) {
    if (t) { clearTimeout(t); t = null; }
    return await fn.apply(this, args);
  };
  wrapped.cancel = function () { if (t) { clearTimeout(t); t = null; } };
  return wrapped;
}

export function jsonSize(v) {
  try { return new Blob([JSON.stringify(v)]).size; }
  catch { return 0; }
}

export function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

// ---------- Sanitize ----------
// Strip large binary fields from any value before persisting to chrome.storage.
// Whitelist of fields that are SAFE to keep on text-like objects.
const _HEAVY_KEYS = new Set([
  'dataUrl', 'data_url', 'base64', 'image', 'image_base64',
  'screenshot', 'thumbnail', 'binary', 'bytes', 'arrayBuffer',
  'data',          // anthropic image source.data → giant base64
  'media_type_data',
]);

const _MAX_TEXT_PER_FIELD = 32 * 1024;       // 32 KB per text field
const _MAX_TOTAL_PER_MESSAGE = 200 * 1024;   // 200 KB per message

function _trimString(s, cap = _MAX_TEXT_PER_FIELD) {
  if (typeof s !== 'string') return s;
  if (s.length <= cap) return s;
  return s.slice(0, cap) + `…[trimmed ${s.length - cap} chars]`;
}

// Replace anthropic image content blocks with a tiny stub, but keep text/tool blocks.
function _sanitizeContentBlock(b) {
  if (!b || typeof b !== 'object') return b;
  if (b.type === 'image') {
    return {
      type: 'image',
      _stripped: true,
      media_type: b.source?.media_type || 'image/png',
    };
  }
  if (b.type === 'document') {
    return {
      type: 'document',
      _stripped: true,
      media_type: b.source?.media_type || 'application/pdf',
    };
  }
  if (b.type === 'tool_result') {
    // tool_result.content can be string OR array (may include image blocks)
    let c = b.content;
    if (Array.isArray(c)) c = c.map(_sanitizeContentBlock);
    else if (typeof c === 'string') c = _trimString(c);
    return { ...b, content: c };
  }
  if (b.type === 'tool_use') {
    return { ...b, input: _shallowSanitize(b.input) };
  }
  if (b.type === 'text') {
    return { ...b, text: _trimString(b.text) };
  }
  if (b.type === 'thinking') {
    return { ...b, thinking: _trimString(b.thinking) };
  }
  return b;
}

function _shallowSanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(_shallowSanitize);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (_HEAVY_KEYS.has(k)) continue;
    if (typeof v === 'string') out[k] = _trimString(v);
    else if (v && typeof v === 'object') out[k] = _shallowSanitize(v);
    else out[k] = v;
  }
  return out;
}

// Public: sanitize a single message (Anthropic shape).
export function sanitizeMessage(msg) {
  if (!msg || typeof msg !== 'object') return msg;
  let content = msg.content;
  if (Array.isArray(content)) content = content.map(_sanitizeContentBlock);
  else if (typeof content === 'string') content = _trimString(content, _MAX_TOTAL_PER_MESSAGE);
  return { role: msg.role, content };
}

// Public: sanitize whole conversation, with hard caps.
export function sanitizeConversation(conv, { maxMessages = 30 } = {}) {
  if (!Array.isArray(conv)) return [];
  let trimmed = conv;
  if (trimmed.length > maxMessages) trimmed = trimmed.slice(-maxMessages);
  return trimmed.map(sanitizeMessage);
}

// Public: sanitize chat entry (the {id, title, conversation, …} thing).
export function sanitizeChat(chat, { maxMessages = 30 } = {}) {
  if (!chat) return chat;
  return {
    id: chat.id,
    title: chat.title,
    titleEdited: !!chat.titleEdited,
    mode: chat.mode,
    model: chat.model,
    conversation: sanitizeConversation(chat.conversation || [], { maxMessages }),
    updatedAt: chat.updatedAt || Date.now(),
  };
}

// ---------- Quota-aware storage writes ----------
// Soft thresholds well below the 10MB hard limit.
const QUOTA_SOFT_BYTES = 5 * 1024 * 1024;    // 5 MB warn level
const QUOTA_HARD_BYTES = 8 * 1024 * 1024;    // 8 MB stop-and-trim
const _QUOTA_RE = /quota|kQuotaBytes/i;

/**
 * safeStorageSet(payload, opts?)
 *   - measures payload size
 *   - if it'd push us past 8MB, trims `chats` array first (oldest dropped)
 *   - on quota error, halves chats and retries up to 3x
 *   - never throws — logs warning instead
 *
 * opts.onTrim(droppedCount) — callback when chats are trimmed.
 */
export async function safeStorageSet(payload, opts = {}) {
  const { onTrim } = opts;
  if (!payload || typeof payload !== 'object') return false;

  // Pre-flight size check: if payload includes `chats`, trim aggressively first
  let attempt = { ...payload };
  let size = jsonSize(attempt);
  if (size > QUOTA_SOFT_BYTES) {
    logger.warn(`storage payload large: ${fmtBytes(size)} (soft cap ${fmtBytes(QUOTA_SOFT_BYTES)})`);
  }
  if (Array.isArray(attempt.chats) && size > QUOTA_HARD_BYTES) {
    const before = attempt.chats.length;
    while (attempt.chats.length > 1 && jsonSize(attempt) > QUOTA_HARD_BYTES) {
      attempt.chats = attempt.chats.slice(0, Math.max(1, Math.floor(attempt.chats.length * 0.7)));
    }
    const dropped = before - attempt.chats.length;
    if (dropped > 0) {
      logger.warn(`pre-flight trim: dropped ${dropped} oldest chats to fit quota`);
      onTrim?.(dropped);
    }
  }

  for (let tries = 0; tries < 3; tries++) {
    try {
      await chrome.storage.local.set(attempt);
      logger.debug(`saved ${Object.keys(attempt).join(',')} (${fmtBytes(jsonSize(attempt))})`);
      return true;
    } catch (e) {
      const msg = String(e?.message || e);
      if (!_QUOTA_RE.test(msg)) {
        logger.error('storage.set failed (non-quota):', msg);
        return false;
      }
      logger.warn(`storage quota exceeded (try ${tries + 1}/3): ${msg}`);
      if (Array.isArray(attempt.chats) && attempt.chats.length > 1) {
        const before = attempt.chats.length;
        attempt.chats = attempt.chats.slice(0, Math.floor(attempt.chats.length / 2));
        onTrim?.(before - attempt.chats.length);
        continue;
      }
      // Last resort: drop heavy keys
      if (attempt.recordings) delete attempt.recordings;
      if (Array.isArray(attempt.chats)) attempt.chats = attempt.chats.slice(0, 1);
    }
  }
  logger.error('storage.set giving up after 3 retries');
  return false;
}

// ---------- IndexedDB blob store ----------
// One DB, two stores:
//   - blobs:  large binary data keyed by id (attachments, dataUrls)
//   - meta:   lightweight references / metadata
//
// Use putBlob() before discarding base64; getBlob() to retrieve on demand.

const DB_NAME = 'moonbridge';
const DB_VERSION = 1;
const STORE_BLOBS = 'blobs';
const STORE_META = 'meta';

let _dbPromise = null;

function _openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        const s = db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function _idbReq(store, mode, fn) {
  return _openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const s = tx.objectStore(store);
    const req = fn(s);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export async function putBlob(id, data, meta = {}) {
  // data: string (base64) | ArrayBuffer | Blob
  const record = {
    id,
    data,
    mime: meta.mime || 'application/octet-stream',
    filename: meta.filename || id,
    size: meta.size || (typeof data === 'string' ? data.length : (data?.byteLength || data?.size || 0)),
    kind: meta.kind || 'binary',
    createdAt: Date.now(),
  };
  return _idbReq(STORE_BLOBS, 'readwrite', (s) => s.put(record));
}

export async function getBlob(id) {
  return _idbReq(STORE_BLOBS, 'readonly', (s) => s.get(id));
}

export async function deleteBlob(id) {
  return _idbReq(STORE_BLOBS, 'readwrite', (s) => s.delete(id));
}

export async function listBlobs() {
  return _idbReq(STORE_BLOBS, 'readonly', (s) => s.getAll());
}

// Drop blobs older than `maxAgeMs` (default 7 days).
export async function pruneOldBlobs(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  const all = await listBlobs();
  let dropped = 0;
  for (const b of all) {
    if (b.createdAt < cutoff) {
      await deleteBlob(b.id);
      dropped++;
    }
  }
  if (dropped) logger.info(`pruned ${dropped} old blobs`);
  return dropped;
}

// ---------- Storage diagnostics ----------
export async function reportStorageUsage() {
  try {
    const used = await chrome.storage.local.getBytesInUse(null);
    const quota = chrome.storage.local.QUOTA_BYTES || 10 * 1024 * 1024;
    const pct = (used / quota * 100).toFixed(1);
    logger.info(`chrome.storage.local: ${fmtBytes(used)} / ${fmtBytes(quota)} (${pct}%)`);
    return { used, quota, pct: +pct };
  } catch (e) {
    logger.warn('storage usage check failed:', e.message);
    return null;
  }
}

// ---------- rAF-throttled callback ----------
// Use for frequent UI calls (scroll, render) so they coalesce to one paint.
export function rafThrottle(fn) {
  let queued = false;
  let lastArgs = null;
  return function (...args) {
    lastArgs = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn.apply(this, lastArgs);
    });
  };
}
