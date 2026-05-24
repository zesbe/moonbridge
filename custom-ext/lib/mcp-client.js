// MCP client: WebSocket connection from MoonBridge sidepanel to the
// moonbridge-bridge MCP server (Node, runs on localhost).
//
// The bridge listens on ws://127.0.0.1:9777 (configurable via env var on
// bridge side). When connected, every tool_call message we receive from the
// bridge is dispatched to executeTool() and the result is sent back.
//
// Status events emitted via onStatus callback:
//   'disconnected' | 'connecting' | 'connected'
//
// This module also exposes connect()/disconnect() so the UI can toggle.

import { executeTool } from './tools.js';
import { memoryAdapter } from './memory.js';
import { kbAdapter } from './kb.js';

const DEFAULT_URL = 'ws://127.0.0.1:9777';
const RECONNECT_MIN_MS = 2000;
const RECONNECT_MAX_MS = 30000;

export class McpClient {
  constructor({ url, onStatus, onLog } = {}) {
    this.url = url || DEFAULT_URL;
    this.onStatus = onStatus || (() => {});
    this.onLog = onLog || (() => {});
    this.ws = null;
    this.want = false;            // user wants to be connected
    this.status = 'disconnected';
    this.reconnectMs = RECONNECT_MIN_MS;
    this.reconnectTimer = null;
  }

  setStatus(s) {
    if (this.status === s) return;
    this.status = s;
    this.onStatus(s);
  }

  connect(url) {
    if (url) this.url = url;
    this.want = true;
    this._open();
  }

  disconnect() {
    this.want = false;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  _open() {
    if (this.ws && this.ws.readyState <= 1) return;
    this.setStatus('connecting');
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch (e) {
      this.onLog(`open error: ${e.message}`);
      this._scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.reconnectMs = RECONNECT_MIN_MS;
      this.setStatus('connected');
      ws.send(JSON.stringify({
        type: 'hello',
        version: chrome.runtime.getManifest().version,
        userAgent: navigator.userAgent,
      }));
    });
    ws.addEventListener('message', (ev) => this._onMessage(ev.data));
    ws.addEventListener('close', () => {
      if (this.ws === ws) this.ws = null;
      if (this.want) {
        this.setStatus('connecting');
        this._scheduleReconnect();
      } else {
        this.setStatus('disconnected');
      }
    });
    ws.addEventListener('error', (e) => {
      this.onLog(`ws error: ${e.message || ''}`);
    });
  }

  _scheduleReconnect() {
    if (!this.want) return;
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectMs = Math.min(RECONNECT_MAX_MS, Math.floor(this.reconnectMs * 1.5));
      this._open();
    }, this.reconnectMs);
  }

  async _onMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type !== 'tool_call' || msg.id == null) return;
    const id = msg.id;
    const tool = String(msg.tool || '');
    const input = msg.input || {};
    let result;
    try {
      result = await executeTool(tool, input, {
        memory: memoryAdapter,
        kb: kbAdapter,
        approvalMode: 'never', // CLI-driven calls run without UI approval gate
      });
    } catch (e) {
      result = { is_error: true, content: `Bridge executor crashed: ${e.message}` };
    }
    // Strip dataUrl preview before sending over wire (use base64 already in content for images)
    if (result && '_dataUrl' in result) delete result._dataUrl;
    try {
      this.ws?.send(JSON.stringify({
        type: 'tool_result',
        id,
        content: result.content,
        isError: !!result.is_error,
      }));
    } catch (e) {
      this.onLog(`send result failed: ${e.message}`);
    }
  }
}

export const mcpClient = new McpClient();
