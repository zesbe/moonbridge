// MoonBridge MCP bridge.
//
// Two modes:
//   1. `moonbridge-bridge serve`  — daemon. WebSocket server on :9777.
//                                   Multiplexes between extension + N stdio bridges.
//   2. `moonbridge-bridge`        — stdio MCP server. Connects to daemon as a WS
//                                   client. Claude Code spawns this per session.
//
// Flow when user types in Claude Code:
//
//   Claude Code -[stdio MCP]→ stdio bridge -[WS]→ daemon -[WS]→ extension
//                                                    │
//                                                    └─ multiplexes IDs
//
// Run `moonbridge-bridge serve` once (terminal/systemd/launchd) so the
// extension keeps a stable connection (green dot stays green).

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer, WebSocket } from 'ws';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.MOONBRIDGE_PORT || '9777', 10);
const TOOLS_PATH = join(__dirname, 'tools.json');

const TOOLS = JSON.parse(readFileSync(TOOLS_PATH, 'utf8'));
const MCP_TOOLS = TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  inputSchema: t.input_schema || { type: 'object', properties: {} },
}));

const log = (...args) => process.stderr.write('[moonbridge] ' + args.join(' ') + '\n');

// ---------------------------------------------------------------------------
// DAEMON: WS server multiplexing extension <-> N bridges
// ---------------------------------------------------------------------------

function startDaemon() {
  let extSocket = null;
  const bridges = new Set();              // ws sockets identifying themselves as 'bridge'
  const inflight = new Map();              // globalId -> { bridgeWs, originalId, timer }
  let nextGlobalId = 1;

  const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });
  wss.on('listening', () => log(`daemon listening on 127.0.0.1:${PORT}`));
  wss.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      log(`port ${PORT} in use — daemon already running? exiting.`);
      process.exit(2);
    }
    log('daemon error:', e.message);
  });

  wss.on('connection', (ws, req) => {
    let role = 'unknown';

    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(raw.toString()); } catch { return; }

      if (m.type === 'hello') {
        // Older clients (pre-role) default to 'extension' (the only client before)
        role = m.role || 'extension';
        if (role === 'extension') {
          if (extSocket && extSocket !== ws) {
            try { extSocket.close(); } catch {}
          }
          extSocket = ws;
          log('extension connected');
        } else if (role === 'bridge') {
          bridges.add(ws);
          log('bridge attached  (count:', bridges.size + ')');
        }
        return;
      }

      if (role === 'bridge' && m.type === 'tool_call') {
        log('tool_call →', m.tool, JSON.stringify(m.input).slice(0, 80));
        if (!extSocket || extSocket.readyState !== extSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'tool_result', id: m.id,
            content: 'MoonBridge extension is not connected. Open the sidepanel in Chrome.',
            isError: true,
          }));
          return;
        }
        const gid = nextGlobalId++;
        const timer = setTimeout(() => {
          inflight.delete(gid);
          try {
            ws.send(JSON.stringify({ type: 'tool_result', id: m.id, content: 'Tool call timed out', isError: true }));
          } catch {}
        }, 90_000);
        inflight.set(gid, { bridgeWs: ws, originalId: m.id, timer });
        try {
          extSocket.send(JSON.stringify({ ...m, id: gid }));
        } catch (e) {
          clearTimeout(timer);
          inflight.delete(gid);
          ws.send(JSON.stringify({ type: 'tool_result', id: m.id, content: `Forward failed: ${e.message}`, isError: true }));
        }
        return;
      }

      if (role === 'extension' && m.type === 'tool_result') {
        const map = inflight.get(m.id);
        if (!map) { log('orphan tool_result for gid=', m.id); return; }
        clearTimeout(map.timer);
        inflight.delete(m.id);
        const txt = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        log('tool_result ← ', txt.slice(0, 80).replace(/\n/g, ' | '));
        try {
          map.bridgeWs.send(JSON.stringify({ ...m, id: map.originalId }));
        } catch (e) {
          log('forward result failed:', e.message);
        }
      }
    });

    ws.on('close', () => {
      if (ws === extSocket) {
        extSocket = null;
        log('extension disconnected');
      }
      if (bridges.has(ws)) {
        bridges.delete(ws);
        log('bridge detached  (count:', bridges.size + ')');
      }
      // Drop inflight requests routed via this socket
      for (const [gid, info] of inflight) {
        if (info.bridgeWs === ws) {
          clearTimeout(info.timer);
          inflight.delete(gid);
        }
      }
    });

    ws.on('error', (e) => log('socket error:', e.message));
  });

  log('Daemon mode. Press Ctrl+C to stop.');
  // Heartbeat keep-alive
  setInterval(() => {}, 60_000);
}

// ---------------------------------------------------------------------------
// STDIO BRIDGE: spawned by Claude Code, relays stdio MCP <-> daemon WS
// ---------------------------------------------------------------------------

function startStdio() {
  let ws = null;
  let ready = false;
  let attempts = 0;
  const pending = new Map(); // localId -> { resolve, reject, timer }
  let nextLocalId = 1;
  const queue = []; // outgoing messages while disconnected

  function connect() {
    attempts++;
    let sock;
    try { sock = new WebSocket(`ws://127.0.0.1:${PORT}`); }
    catch (e) {
      log('cannot create WS:', e.message);
      setTimeout(connect, 2000);
      return;
    }
    sock.on('open', () => {
      ws = sock;
      ready = true;
      attempts = 0;
      sock.send(JSON.stringify({ type: 'hello', role: 'bridge', version: '1.0.0' }));
      // Flush queued messages
      while (queue.length) sock.send(queue.shift());
    });
    sock.on('message', (raw) => {
      let m;
      try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.type !== 'tool_result' || m.id == null) return;
      const p = pending.get(m.id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(m.id);
      p.resolve(m);
    });
    sock.on('close', () => {
      ws = null;
      ready = false;
      for (const [, p] of pending) {
        clearTimeout(p.timer);
        p.reject(new Error('Daemon disconnected'));
      }
      pending.clear();
      // Brief retry — daemon may be restarting
      const delay = Math.min(15_000, 1000 * Math.pow(1.5, Math.min(attempts, 6)));
      setTimeout(connect, delay);
    });
    sock.on('error', () => {});
  }
  connect();

  function callExtension(toolName, args, timeoutMs = 60_000) {
    return new Promise((resolve, reject) => {
      if (!ready) {
        return reject(new Error(
          'MoonBridge daemon is not running. Start it with: moonbridge-bridge serve'
        ));
      }
      const id = nextLocalId++;
      const msg = JSON.stringify({ type: 'tool_call', id, tool: toolName, input: args || {} });
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Tool '${toolName}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      try { ws.send(msg); }
      catch (e) {
        clearTimeout(timer);
        pending.delete(id);
        reject(e);
      }
    });
  }

  // ── MCP stdio server ────────────────────────────────────────────────────
  const server = new Server(
    { name: 'moonbridge', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: MCP_TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      const res = await callExtension(name, args);
      return {
        isError: !!res.isError,
        content: normalizeContent(res.content),
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: 'text', text: e.message || String(e) }],
      };
    }
  });

  const transport = new StdioServerTransport();
  return server.connect(transport);
}

function normalizeContent(c) {
  if (typeof c === 'string') return [{ type: 'text', text: c }];
  if (Array.isArray(c)) {
    return c.map((b) => {
      if (b.type === 'text') return { type: 'text', text: b.text || '' };
      if (b.type === 'image' && b.source?.data) {
        return { type: 'image', data: b.source.data, mimeType: b.source.media_type || 'image/png' };
      }
      return { type: 'text', text: JSON.stringify(b) };
    });
  }
  return [{ type: 'text', text: String(c) }];
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

export async function startBridge() {
  const cmd = (process.argv[2] || '').toLowerCase();
  if (cmd === 'serve' || cmd === 'daemon' || cmd === 'start') {
    startDaemon();
    return;
  }
  if (cmd === '--version' || cmd === '-v') {
    process.stdout.write('moonbridge-bridge 1.1.0\n');
    process.exit(0);
  }
  if (cmd === '--help' || cmd === '-h') {
    process.stdout.write(`moonbridge-bridge

Usage:
  moonbridge-bridge serve         Start the daemon (run once, keep open).
  moonbridge-bridge               Stdio MCP mode for Claude Code.

Env:
  MOONBRIDGE_PORT=<port>          Override default 9777.

Setup with Claude Code (stdio mode talks to daemon):
  moonbridge-bridge serve &       # in another terminal
  claude mcp add moonbridge --transport stdio moonbridge-bridge
`);
    process.exit(0);
  }
  return startStdio();
}
