// End-to-end test for the daemon + stdio architecture.
//
// Topology:
//   [test] spawns daemon (`moonbridge-bridge serve`)
//   [test] spawns stdio bridge (`moonbridge-bridge`) — connects to daemon
//   [test] connects fake extension via WS as the "extension" role
//   [test] sends MCP requests via stdio bridge stdin
//
//   Result flow: stdio bridge → daemon → fake ext → daemon → stdio bridge → stdout

import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(__dirname, '..', 'bin', 'moonbridge-bridge.js');
const WS_URL = 'ws://127.0.0.1:9777';

const log = (...args) => console.log('[test]', ...args);

function spawnBridge(args = []) {
  const c = spawn('node', [BRIDGE, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
  c.stderr.on('data', (b) => process.stderr.write('[' + (args[0] || 'stdio') + '.err] ' + b));
  return c;
}

async function main() {
  // 1. Start daemon
  log('starting daemon...');
  const daemon = spawnBridge(['serve']);
  await new Promise((r) => setTimeout(r, 600));

  // 2. Connect fake extension
  log('connecting fake extension...');
  const ws = new WebSocket(WS_URL);
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
  ws.send(JSON.stringify({ type: 'hello', role: 'extension', version: 'test' }));
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.type !== 'tool_call') return;
    log('fake ext received:', m.tool, JSON.stringify(m.input).slice(0, 60));
    let content;
    if (m.tool === 'list_tabs') content = '---OPEN TABS (2)---\nid=1 [active] https://example.com';
    else if (m.tool === 'click') content = `Clicked ${m.input.selector}.`;
    else content = `[fake] ${m.tool} echoed`;
    ws.send(JSON.stringify({ type: 'tool_result', id: m.id, content, isError: false }));
  });
  await new Promise((r) => setTimeout(r, 300));

  // 3. Spawn stdio bridge
  log('spawning stdio bridge...');
  const bridge = spawnBridge();
  let buf = '';
  const pending = new Map();
  let nextId = 1;
  bridge.stdout.on('data', (b) => {
    buf += b.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.id != null && pending.has(msg.id)) {
        const { resolve } = pending.get(msg.id);
        pending.delete(msg.id);
        resolve(msg);
      }
    }
  });

  function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      bridge.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); reject(new Error('timeout ' + method)); }
      }, 8000);
    });
  }

  await new Promise((r) => setTimeout(r, 800));

  // 4. MCP handshake
  log('initialize...');
  const init = await send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '0' } });
  log('init:', JSON.stringify(init.result?.serverInfo));

  bridge.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  log('list tools...');
  const list = await send('tools/list', {});
  log(`got ${list.result.tools.length} tools`);

  // 5. Round-trip via daemon
  log('calling list_tabs...');
  const r1 = await send('tools/call', { name: 'list_tabs', arguments: {} });
  const t1 = r1.result?.content?.[0]?.text || '';
  log('list_tabs result:', t1.slice(0, 80));
  if (!t1.includes('OPEN TABS')) throw new Error('list_tabs roundtrip failed');

  log('calling click...');
  const r2 = await send('tools/call', { name: 'click', arguments: { selector: '#login' } });
  const t2 = r2.result?.content?.[0]?.text || '';
  log('click result:', t2.slice(0, 80));
  if (!t2.includes('Clicked #login')) throw new Error('click failed');

  // 6. Multiple bridges sharing the same daemon
  log('spawning a SECOND stdio bridge to verify multiplexing...');
  const bridge2 = spawnBridge();
  let buf2 = '';
  const pending2 = new Map();
  let nextId2 = 1;
  bridge2.stdout.on('data', (b) => {
    buf2 += b.toString();
    let i;
    while ((i = buf2.indexOf('\n')) >= 0) {
      const line = buf2.slice(0, i).trim();
      buf2 = buf2.slice(i + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.id != null && pending2.has(msg.id)) {
        const { resolve } = pending2.get(msg.id);
        pending2.delete(msg.id);
        resolve(msg);
      }
    }
  });
  function send2(method, params = {}) {
    const id = nextId2++;
    return new Promise((resolve, reject) => {
      pending2.set(id, { resolve, reject });
      bridge2.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      setTimeout(() => { if (pending2.has(id)) { pending2.delete(id); reject(new Error('timeout')); } }, 5000);
    });
  }
  await new Promise((r) => setTimeout(r, 700));
  await send2('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e2', version: '0' } });
  bridge2.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const r3 = await send2('tools/call', { name: 'list_tabs', arguments: {} });
  log('bridge2 result:', (r3.result?.content?.[0]?.text || '').slice(0, 60));
  if (!(r3.result?.content?.[0]?.text || '').includes('OPEN TABS')) throw new Error('bridge2 failed');

  log('✅ ALL TESTS PASSED');
  ws.close();
  bridge.kill();
  bridge2.kill();
  daemon.kill();
  process.exit(0);
}

main().catch((e) => {
  log('❌ FAIL:', e.message);
  process.exit(1);
});
