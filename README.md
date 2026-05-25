# MoonBridge

> Smart browser automation agent for Chrome. 159 tools, 3-mantra doctrine (LOOK FIRST, ASK IF UNSURE, VERIFY DONE), Claude-style sidepanel.

MoonBridge is a Chrome extension that turns any Anthropic-compatible endpoint into a browser automation agent — read tabs, click buttons, fill forms, verify state, iframe-aware, vision fallback. It's not just "a Claude wrapper" — it's a smart agent with explicit doctrine, self-healing selectors, parallel task execution, and a memory loop that gets better with use.

```
┌───────────────────────────────┐                ┌──────────────────┐
│  MoonBridge sidepanel         │   159 tools    │  Any web page    │
│  • Live agent timeline        │ ◄─────────────►│  (read, click,   │
│  • Streaming caret            │                │   navigate,      │
│  • Inline screenshot preview  │                │   screenshot…)   │
└─────────────┬─────────────────┘                └──────────────────┘
              │
              │  Anthropic Messages API
              ▼
   ┌──────────────────────────┐
   │  Your endpoint           │  Anthropic / Bedrock / proxy / LiteLLM
   │  (any /messages adapter) │
   └──────────────────────────┘

   ┌────────────── optional Claude Code CLI bridge ──────────────┐
   │                                                              │
   │  Claude Code CLI ──stdio─► moonbridge-bridge ──WS─► extension│
   │                                                              │
   └──────────────────────────────────────────────────────────────┘
```

## What makes it smart

**3-Mantra Doctrine** baked into the system prompt:

1. **LOOK FIRST, THEN ACT** — Run `get_page` before any click/type to verify the element exists and the page is in the expected state. No blind clicks.
2. **ASK IF UNSURE** — STOP and ask the user when blocked: login required, captcha detected, ambiguous instruction, destructive action, multiple matches.
3. **VERIFY DONE BEFORE DECLARING SUCCESS** — Don't say "selesai" until verified via `get_page` / `media_state` / `wait_for_toast`. No fake success.

**Power tools** that change what the agent can do:

- `parallel_task` — Read 5 tabs concurrently. Cuts latency from `sum` to `max`.
- `execute_plan` — Multi-step workflow with intermediate result passing via `${steps[N].content}`.
- `iframe_query` — Operate inside iframes via Chrome scripting frameIds (Oracle Console, GSC, embedded payments).
- `vision_query` — Last-resort visual reasoning when DOM is empty (canvas, charts).
- `media_state` — Read `<video>`/`<audio>` state without execute_js (Trusted Types-safe).
- `wait_for_idle dom_stable_ms=N` — SPA-aware settle (DOM + network).
- `wait_for_toast` — Detect Material/Antd/Radix toast patterns to confirm submit success.
- `dismiss_modal` — Auto-close cookie banners (OneTrust, TrustE, common patterns).
- `find_element`, `smart_click`, `smart_type` — Fuzzy semantic matching.

**Self-healing selectors.** When `#ref-N` becomes stale after rerender, falls back to label/aria-label/role match instead of failing.

**Auto task_context.** Every turn, the system prompt is auto-injected with current tab IDs, active tab, audible flag — agent stays oriented across multi-turn workflows.

**Memory discipline.** Agent is taught to actively call `remember` for durable facts (account names, regions, properties) at task end. Memories auto-recall on subsequent sessions.

**Trusted Types-aware.** When `execute_js` is blocked by `require-trusted-types-for 'script'` (YouTube, Google, banking), falls back through 3 layers: ISOLATED → MAIN (with TT policy) → CDP `Runtime.evaluate` with `allowUnsafeEvalBlockedByCSP: true`.

**Click error semantics.** `click()` returns `error_kind`: `NOT_FOUND` / `NOT_VISIBLE` / `DISABLED` / `COVERED` (with `covered_by` selector) so agent picks the right recovery — close modal vs find new selector vs wait for enable.

## UI features

- **Hybrid Cursor + Live Ticker timeline** — One persistent batch per turn with `↻` iteration separators. Auto-collapses to mini chips on next turn. Live streaming animations (slide-in, flash, spin, success-pop).
- **Streaming caret + lifecycle states** — Assistant message goes through `creating → streaming → finalizing → completed`. Blinking ▍ caret while live, fades out on done.
- **Inline screenshot preview** — Screenshot tool result renders directly under the activity row. Compact thumbnail when completed, full size while running. Click to zoom.
- **Glassmorphism chat bubbles** — User pill (gradient + blur), assistant accent bar (no card, full-width prose).
- **Slash commands** — `/dump-trace`, `/clear-trace`, `/storage`, `/debug-on/-off`, `/help`. Run locally, no token spend.
- **Hot reload dev workflow** — `node scripts/dev-watch.js` + dev-mode SW WS client = ~1s edit-to-reload loop.
- **Tracelog ring buffer** — IDB-backed 1000-entry log of every tool execution. `/dump-trace 50` copies last 50 to clipboard for bug reports.

## Repo layout

```
moonbridge/
├── custom-ext/         # Chrome extension (load this folder unpacked)
│   ├── manifest.json
│   ├── sidepanel.{html,css,js}
│   ├── service-worker.js
│   ├── tsconfig.json   # gradual TS via @ts-check, no bundler
│   ├── scripts/
│   │   └── dev-watch.js  # hot reload WS server
│   ├── lib/            # tools.js (159 tools), agent.js, storage, memory, kb, …
│   ├── content/
│   ├── icons/
│   └── options.{html,css,js}
│
└── mcp-bridge/         # Optional MCP bridge for Claude Code CLI
    ├── bin/moonbridge-bridge.js
    ├── src/server.js
    ├── src/tools.json  # tool schema mirror (159)
    └── README.md
```

## Quick start

### 1. Install the extension

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

Click the MoonBridge icon → opens sidepanel → Settings (overflow menu → ⚙).

```
Base URL:    https://your-proxy.example/v1
API key:     sk-...
Model:       claude-sonnet-4-5  (or whatever your proxy serves)
```

Any endpoint that speaks the Anthropic Messages API works:

- The official Anthropic API
- AWS Bedrock (via translation proxy)
- LiteLLM, OpenRouter, custom gateways
- Self-hosted Ollama with Anthropic adapter

### 3. (Optional) Connect Claude Code CLI

```bash
cd mcp-bridge
npm install
npm link

# Register with Claude Code:
claude mcp add moonbridge --transport stdio moonbridge-bridge
```

Then in MoonBridge, click the **bridge dot** in the topbar — turns green when Claude Code connects. From terminal:

```
$ claude
> Cek free tier di Oracle Cloud, AWS, dan GCP parallel
🔧 moonbridge:parallel_task
🔧 moonbridge:read_tab × 3 (concurrent)
✅ Oracle: 2 AMD VMs active, 4 ARM Ampere active
   AWS:    EC2 t2.micro 750h remaining, RDS expires 2027-Jan
   GCP:    e2-micro free, Cloud Storage 5GB free
```

See [`mcp-bridge/README.md`](mcp-bridge/README.md) for details.

## How the agent works

### Doctrine-driven loop

```
User prompt
  ↓
Auto-inject task_context (tabs, active, audible)
  ↓
runAgent unbounded loop:
  for each iteration:
    ├─ Stream from endpoint
    ├─ <thinking> block (forced) → plan in MoonBridge ticker
    ├─ Parse tool_use blocks
    ├─ Read-only tools → Promise.all (parallel)
    ├─ Mutating tools → sequential
    ├─ Append tool_result, loop
    └─ End when:
       - Model emits text without tool calls
       - User cancels
       - Agent calls "ASK" pattern (text only, no tool)
```

### Tool execution layers (CSP bypass)

When `execute_js` runs:

1. **Isolated world** — Extension's own JS sandbox, immune to page CSP
2. **MAIN world** — Page context, registers TrustedTypes policy `mb-eval` for `new Function`
3. **Debugger CDP** — `chrome.debugger.attach` + `Runtime.evaluate` with `allowUnsafeEvalBlockedByCSP: true`. Last resort, attaches debug bar.

Most tools complete on layer 1. Layer 3 only fires for hostile CSPs.

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

The daemon survives across CLI sessions — solves "stuck yellow" connection state when bridge starts before extension is open.

## Configuration

### Settings (per-extension, `chrome.storage.local`)

| Field | Default | Notes |
|---|---|---|
| Base URL | — | Anthropic-compatible `/v1` endpoint |
| API key | — | Sent as `x-api-key` header |
| Model | `claude-sonnet-4-5` | Any model your endpoint serves |
| Speed preset | Balanced | Fast / Balanced / Quality (affects max_tokens, temperature) |
| System prompt | (built-in) | Optional override (prepended to MoonBridge doctrine) |

### Bridge port

Both ends default to `127.0.0.1:9777`. Override:

```bash
MOONBRIDGE_PORT=12345 moonbridge-bridge
```

Then update the extension's bridge URL in the same settings panel.

### Approval modes (Tools drawer → ⋯ → Tools & Approval)

- **Never** — Fully autonomous, no confirmations
- **Destructive only** (default) — Confirm only on write/delete/transfer-style actions
- **Always** — Manual confirmation per tool call

## Troubleshooting

**`execute_js` fails on YouTube/Google with "Trusted Type" error**
Already auto-handled in v1.6.2+ via 3-layer fallback. If it still fails, the site is using `require-trusted-types-for 'script'` with strict allow-list — agent will get an error message it can react to.

**Agent claims "selesai" without verifying**
This shouldn't happen in v2.0+ thanks to the 3-mantra doctrine. If it does, check that your custom system prompt isn't overriding the doctrine. The doctrine is appended automatically, but a long custom prompt may get cached.

**Sidepanel shows "endpoint error"**
Test with: `curl -H "x-api-key: $KEY" $URL/messages -d '{"model":"…","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}'`. Base URL must include `/v1` (no trailing slash).

**Timeline animations stop after first turn**
Already fixed in v1.7.6 + v1.7.9 (force fresh batch + ghost streaming cleanup). Reload extension.

**Inline screenshot ga muncul di chat 2+**
Already fixed in v1.7.11. Reload.

**Bridge dot stays yellow**
1. Check daemon: `lsof -i :9777`
2. Check extension's bridge URL matches daemon port
3. Restart Chrome (SW caches old socket state)

**`list_tabs` returns hallucinated content**
Each `list_tabs` response includes a unique `[sig=xxx-yyy]` signature. If you don't see it, the model never actually called the tool. Re-prompt: "call list_tabs and quote the sig".

## Development

```bash
# Edit code in custom-ext/ → manual reload at chrome://extensions
# OR set up hot reload:
cd custom-ext
node scripts/dev-watch.js   # WS server on :9012

# Add "version_name": "2.2.0-dev" to manifest.json (gates the WS client in SW)

# Service worker logs: chrome://extensions → MoonBridge → "service worker"
# Sidepanel logs:      Right-click in sidepanel → Inspect
# Bridge logs:         ~/.claude/logs/mcp-moonbridge.log

# Slash commands in chat:
/dump-trace 100   # last 100 tool executions to clipboard
/storage          # current chrome.storage usage
/debug-on         # verbose logger
```

### Contributing

Tool registry parity is enforced — `mcp-bridge/src/tools.json` must match the `case '...'` switch in `custom-ext/lib/tools.js`. The repo has a check script that runs:

```bash
node -e "
  const fs = require('fs');
  const tools = JSON.parse(fs.readFileSync('mcp-bridge/src/tools.json', 'utf8'));
  const tjs = fs.readFileSync('custom-ext/lib/tools.js', 'utf8');
  const cases = [...tjs.matchAll(/case ['\"]([a-z0-9_]+)['\"]:/g)].map(m => m[1]);
  // ... validates count + names
"
```

## License

MIT — see [LICENSE](LICENSE).

## Credits

Built by [@zesbe](https://github.com/zesbe). Inspired by Claude's official Chrome extension, Claude Computer Use, Cursor, and Devin's agent UIs.

---

**Status:** v2.2.0 — agent-only, smart-agent doctrine, 159 tools. Production-ready for browser automation tasks.
