# MoonBridge

> Chrome extension AI agent for any Anthropic-compatible endpoint, with optional MCP bridge to Claude Code CLI.

MoonBridge gives you a Claude-style sidepanel inside Chrome that can **read, click, navigate, screenshot, and reason about any tab** — backed by your own Anthropic-compatible endpoint. Pair it with the MCP bridge and Claude Code CLI gets the same browser superpowers from your terminal.

```
┌──────────────────┐                                    ┌──────────────────┐
│  Sidepanel UI    │                                    │  Any web page    │
│  (Claude-style)  │  ◄── 83 browser tools ──►          │  (read, click,   │
│                  │                                    │   screenshot…)   │
└────────┬─────────┘                                    └──────────────────┘
         │
         │  Anthropic Messages API (your endpoint)
         ▼
┌──────────────────┐
│  Your endpoint   │   e.g. https://your-proxy.example/v1
│  (claude.ai,     │
│   bedrock,       │
│   custom proxy)  │
└──────────────────┘

         ┌──────────────────────── optional ────────────────────────┐
         │                                                          │
┌────────▼─────────┐    stdio MCP    ┌──────────────────┐  WS  ┌────▼──────────┐
│ Claude Code CLI  │ ◄─────────────► │   MCP bridge     │ ◄──► │  MoonBridge   │
│ (terminal)       │                 │  (Node, stdio)   │ :9777│  Chrome ext   │
└──────────────────┘                 └──────────────────┘      └───────────────┘
```

## Features

- **Sidepanel chat** — Pinned to the active tab, like Claude's official extension.
- **83 browser tools** — Read DOM, click, type, scroll, screenshot, navigate, multi-tab/window control, network capture, file download, clipboard, cookies.
- **3-layer CSP bypass** — isolated world → MAIN world → CDP `Runtime.evaluate` with `allowUnsafeEvalBlockedByCSP`. Works on sites that aggressively block content scripts.
- **Hybrid DOM + Vision** — DOM-first for speed, vision fallback for tricky layouts.
- **Activity timeline** — Live tool execution stream like Claude Computer Use / Cursor / Devin.
- **Premium UI** — Charcoal theme, glassmorphism, syntax highlighting, message bubbles, date-grouped history, 6 message actions (copy, regenerate, branch, speak, like, dislike).
- **Memory & knowledge base** — Persistent notes, KB search, scratchpad, scheduled tasks.
- **Prompt caching** — Rolling cache breakpoint to reduce input tokens on long conversations.
- **Parallel tool execution** — Read-only tools run concurrently for speed.
- **MCP bridge** — Expose all 83 tools to Claude Code CLI via stdio MCP.
- **Custom endpoint** — Plug in your own Anthropic-compatible proxy or self-hosted gateway.

## Repo layout

```
moonbridge/
├── custom-ext/         # The Chrome extension (load this folder unpacked)
│   ├── manifest.json
│   ├── sidepanel.{html,css,js}
│   ├── service-worker.js
│   ├── lib/            # tools.js (all 83 tools), agent.js, markdown, highlight, …
│   ├── content/
│   ├── icons/
│   └── options.{html,css,js}
│
└── mcp-bridge/         # Optional MCP bridge for Claude Code CLI
    ├── bin/moonbridge-bridge.js
    ├── src/server.js
    ├── src/tools.json  # auto-extracted tool schema
    └── README.md
```

## Quick start

### 1. Install the Chrome extension

```bash
git clone https://github.com/zesbe/moonbridge.git
cd moonbridge
```

In Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Pick the `custom-ext/` folder (NOT the repo root)
5. Pin MoonBridge to the toolbar

### 2. Configure your endpoint

Click the MoonBridge icon → opens sidepanel → settings (gear icon).

```
Base URL:    https://your-proxy.example/v1
API key:     sk-...
Model:       claude-sonnet-4-5  (or whatever your proxy serves)
```

Any endpoint that speaks the Anthropic Messages API works:

- The official Anthropic API
- AWS Bedrock (via a proxy that translates the wire format)
- Your own self-hosted gateway
- LiteLLM, OpenRouter, etc.

### 3. (Optional) Connect Claude Code CLI

```bash
cd mcp-bridge
npm install
npm link

# Register with Claude Code:
claude mcp add moonbridge --transport stdio moonbridge-bridge
```

Then in the MoonBridge sidepanel, click the **bridge dot** in the top bar — it turns green when Claude Code connects. From your terminal:

```
$ claude
> What tabs do I have open?
🔧 moonbridge:list_tabs
✅ 5 tabs: …

> Click the merge button on the GitHub PR tab
🔧 moonbridge:click(selector="button[data-testid=merge]")
✅ Clicked. URL is now: …
```

See [`mcp-bridge/README.md`](mcp-bridge/README.md) for details.

## How it works

### Tool execution layers

When the agent calls `execute_js` (or any tool that runs code in a page), MoonBridge tries 3 layers in order:

1. **Isolated world** — `chrome.scripting.executeScript({ world: "ISOLATED" })`. Fast, safe, but can't access page-defined globals.
2. **MAIN world** — `world: "MAIN"`. Sees page globals, but blocked by strict CSP.
3. **Debugger CDP** — `chrome.debugger.attach()` + `Runtime.evaluate` with `allowUnsafeEvalBlockedByCSP: true`. Bypasses CSP entirely.

Most tools complete on layer 1. Layer 3 only fires for sites with hostile CSPs (banking, gov sites).

### Agent loop

The agent runs unbounded iterations (no `maxIterations` cap) — it stops only when the model emits text without tool calls, or you hit cancel. Each iteration:

1. Send messages + tool results to the endpoint with prompt caching.
2. Stream the response, parse `tool_use` blocks.
3. Execute read-only tools in parallel (`Promise.all`), serial for state-changing ones.
4. Append `tool_result` blocks. Loop.

### MCP bridge architecture

```
Claude Code CLI ──stdio──► moonbridge-bridge (per-session)
                                  │
                                  │  WebSocket
                                  ▼
                           Daemon @ :9777 (always-on)
                                  │
                                  │  multiplexed by role
                                  ▼
                           MoonBridge sidepanel
```

The daemon stays alive across CLI sessions — solves the "stuck yellow" connection state when the bridge starts before the extension is open.

## Configuration

### Settings (per-extension)

Stored via `chrome.storage.sync`. Open with the gear icon in the sidepanel.

| Field | Default | Notes |
|---|---|---|
| Base URL | — | Anthropic-compatible `/v1` endpoint |
| API key | — | Sent as `x-api-key` header |
| Model | `claude-sonnet-4-5` | Any model your endpoint serves |
| Mode | Balanced | Fast / Balanced / Quality (affects max_tokens, temperature, tool batching) |
| System prompt | (built-in) | Optional override |

### Bridge port

Both ends default to `127.0.0.1:9777`. Override:

```bash
MOONBRIDGE_PORT=12345 moonbridge-bridge
```

Then update the extension's bridge URL in the same settings panel.

## Troubleshooting

**Sidepanel shows "endpoint error"**
Check the base URL ends with `/v1` (no trailing slash). Test with `curl -H "x-api-key: $KEY" $URL/messages -d '{"model":"…","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}'`.

**`element_screenshot` returns wrong region**
This was a known bug — viewport was read from sidepanel (~400px) instead of tab. Fixed in v1.1.0. Reload the extension.

**`clipboard_write` says "Document is not focused"**
Triple fallback runs automatically: sidepanel `window.focus()` → inject into active tab → legacy `execCommand('copy')` via hidden textarea. If all 3 fail, the page has an aggressive focus trap — use `execute_js` to write directly.

**Bridge dot stays yellow**
1. Check the daemon is running: `lsof -i :9777`
2. Check the extension's bridge URL matches the daemon port.
3. Restart Chrome (the SW caches old socket state).

**`list_tabs` returns "clean — nothing to commit"**
That's a hallucination from the model, not MoonBridge. Each `list_tabs` response includes a unique `[sig=xxx-yyy]` signature — if you don't see it in the response, the model never actually called the tool. Re-prompt explicitly: "call list_tabs and quote the sig".

## Development

```bash
# Reload extension after editing custom-ext/:
# chrome://extensions → MoonBridge → reload icon

# Watch the service worker logs:
# chrome://extensions → MoonBridge → "service worker" link

# Watch the sidepanel logs:
# Right-click in sidepanel → Inspect

# Bridge logs (when running via Claude Code):
~/.claude/logs/mcp-moonbridge.log
```

## License

MIT — see [LICENSE](LICENSE).

## Credits

Built by [@zesbe](https://github.com/zesbe). Inspired by Claude's official Chrome extension, Claude Computer Use, Cursor, and Devin's agent UIs.

---

**Status:** v1.1.0 — actively developed. Issues and PRs welcome.
