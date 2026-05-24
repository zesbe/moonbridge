#!/usr/bin/env node
// =====================================================================
// MoonBridge — dev-watch
// Filesystem watcher + WebSocket broadcaster for hot reload during dev.
//
// Usage:
//   node scripts/dev-watch.js
//
// Pair with the WS client in service-worker.js (gated by version_name
// containing "dev"). Edit any file under custom-ext/ → SW receives
// "reload" → chrome.runtime.reload() → ~1s end-to-end vs ~6s manual.
//
// Zero-deps version: uses Node's built-in `node:http` upgrade for the
// minimal WS handshake. Only RFC6455 text frames in one direction
// (server → client) are needed since we only push "reload".
// =====================================================================

import { watch } from 'node:fs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PORT = Number(process.env.MB_DEV_PORT) || 9012;

const IGNORE_RE = /(\.swp$|~$|^\.git|node_modules|\.DS_Store)/;

// ---------------------------------------------------------------------
// Minimal WS server (no `ws` dep). Server-to-client text frames only.
// ---------------------------------------------------------------------
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
/** @type {Set<import('net').Socket>} */
const clients = new Set();

const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('moonbridge dev-watch ws');
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();
  const accept = createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  clients.add(socket);
  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
  console.log(`[dev-watch] client connected (${clients.size} total)`);
});

function frameText(text) {
  const data = Buffer.from(text);
  const len = data.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, data]);
}

function broadcast(text) {
  const frame = frameText(text);
  for (const sock of clients) {
    try { sock.write(frame); } catch {}
  }
}

server.listen(PORT, () => {
  console.log(`[dev-watch] listening on ws://localhost:${PORT}`);
  console.log(`[dev-watch] watching: ${ROOT}`);
});

// ---------------------------------------------------------------------
// Filesystem watcher — debounced.
// ---------------------------------------------------------------------
let pending = null;
function scheduleReload(reason) {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    console.log(`[reload] ${reason}`);
    broadcast(JSON.stringify({ type: 'reload', ts: Date.now(), reason }));
  }, 80); // small debounce: editors do multi-event saves
}

watch(ROOT, { recursive: true }, (event, filename) => {
  if (!filename) return;
  if (IGNORE_RE.test(filename)) return;
  // Only meaningful changes
  const rel = relative(ROOT, resolve(ROOT, filename));
  if (rel.startsWith('..')) return;
  scheduleReload(rel);
});

process.on('SIGINT', () => {
  console.log('\n[dev-watch] shutting down');
  server.close();
  process.exit(0);
});
