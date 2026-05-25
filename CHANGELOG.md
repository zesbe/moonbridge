# Changelog

All notable changes to MoonBridge are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/), versioning follows [Semantic Versioning](https://semver.org/).

## [2.2.0] — 2026-05-25

### Added — Power tools
- **`parallel_task`** — Run independent tool calls concurrently via `Promise.all`. Cuts latency from `sum(N)` to `max(N)`. Best for: read 5 tabs, screenshot 3 pages, fetch multiple URLs.
- **`execute_plan`** — Multi-step plan with intermediate result passing via `${steps[N].content}` syntax. Variable substitution before each step. Saves N round-trips → 1 LLM call.
- **`iframe_query`** — Operate INSIDE specific iframes via `chrome.scripting.executeScript` with `frameIds`. Bypasses cross-origin restrictions. Actions: read | click | type | find_by_text. Critical for Oracle Cloud Console, GSC, embedded payments.
- **`vision_query`** — Last-resort visual reasoning. Screenshots tab + sends to vision model with question. Returns natural language answer about UI. For canvas/charts/image-only pages.

### Added — System prompt sections
- **MEMORY DISCIPLINE** — Agent taught to actively call `remember()` for durable facts at task end (account names, regions, properties). With explicit do/don't examples.
- **SMARTER WORKFLOWS** — Concrete usage examples for execute_plan, parallel_task, iframe_query, vision_query.

### Tool count: 155 → 159

---

## [2.1.0] — 2026-05-25

### Added — SPA & UX tools
- **`wait_for_idle dom_stable_ms=N`** — Extended with DOM stability requirement. Waits for both network idle AND DOM unchanged for N ms. Critical for SPAs (GSC, Oracle Console, Twitter) that look network-idle while still rendering.
- **`wait_for_toast`** — Detects toast/snackbar/notification patterns: `role=status`, `role=alert`, `aria-live`, Material UI, Antd, Radix Toast, Bootstrap. Returns `{text, kind, selector}`.
- **`dismiss_modal`** — Auto-detect and close modals/cookie banners. Tries OneTrust, TrustE, X buttons in dialogs, ESC fallback.

### Added — Smart agent QoL
- **Self-healing selectors** — `__claudeRefMeta__` cache (label, tag, type per ref). When `#ref-N` becomes stale after rerender, falls back to text/aria-label match before failing.
- **`task_context` auto-injection** — System prompt prepended every turn with current browser state: active tab, audible flag, top 6 tabs with IDs. Eliminates "agent forgot tab IDs after 10 turns".

### Added — System prompt sections
- **SPA & TOAST PATTERNS** — Tells agent to use `dom_stable_ms=1000`, `wait_for_toast text_contains="success"`, `dismiss_modal` when `error_kind=COVERED`.
- **IFRAME HANDLING** — Detection strategy + concrete Oracle Cloud Console example.

### Tool count: 153 → 155

---

## [2.0.0] — 2026-05-25 — BREAKING CHANGE

### Removed
- **Chat mode entirely** — `setMode()`, `sendChat()`, mode toggle button, `mode-toggle` CSS, `streamMessages` import. Mode is now const `'agent'`.
- All `if (mode === 'agent') ... else sendChat` branches.

### Added — Smart agent doctrine
- **3-mantra system prompt** baked into agent:
  1. **LOOK FIRST, THEN ACT** — `get_page` before any click/type to verify state
  2. **ASK IF UNSURE** — STOP and ask user when blocked (login, captcha, ambiguous, destructive, multiple matches)
  3. **VERIFY DONE BEFORE DECLARING SUCCESS** — Don't say "selesai" until verified via tool
- **Forced `<thinking>` tags** before tool calls (visible in MoonBridge thinking ticker).
- **8 example scenarios** in prompt covering Oracle login wall, YouTube playback verification, mass delete confirmation, Twitter SPA navigation.
- **Failure recovery patterns** — Agent now reads `error_code` semantics: NOT_FOUND, COVERED, DISABLED, RESTRICTED, TIMEOUT.

### Changed — UI
- New `<div class="agent-badge">🌙 Agent</div>` in topbar (glassmorphism + accent border + glow). Replaces chat/agent toggle.
- Input placeholder always: "Tell the agent what to do..."

---

## [1.7.x] — Late May 2026 — Live-streaming UX milestone

### v1.7.14 — Compact post-task screenshots
- Inline screenshot preview shrinks to 120×220 thumbnail when task completes (was 320px). Hover to re-expand.

### v1.7.13 — Ghost streaming bubbles fix
- Iteration boundary now properly finalizes old assistant bubble before nulling reference. Fixes multiple "MoonBridge · streaming" bubbles stacking across iterations.

### v1.7.12 — Message lifecycle states
- Assistant message data-state: `creating → streaming → finalizing → completed`
- Blinking ▍ caret + "· streaming" label + accent bar pulse during stream
- 220ms caret fade-out on finalize

### v1.7.11 — Inline screenshot reliable across all turns
- `loading="eager"` + `decoding="async"` + onload re-scroll. Fixes "Chat 2 ga ada screenshot".

### v1.7.10 — Inline screenshot preview
- Screenshot tool result renders directly under activity row instead of buried in expandable detail panel.

### v1.7.9 — Force fresh batch per turn
- Defensive `_currentBatch = null` + `compactPreviousTurns()` at runAgentTurn start. CSS `!important` visibility safety net.

### v1.7.8 — Bigger running-state hierarchy
- Running tools: 22→24px icon, accent gradient verb text, brighter scrollbar, accent ring on tool badge.

### v1.7.7 — Animation restore
- translateX → translateY (clipped by `overflow-y:auto`). Removed mask-image.

### v1.7.6 — Multi-turn timeline animation + click error semantics
- `compactPreviousTurns` now matches all `.completed:not(.failed):not(.mini)`.
- Click errors differentiate: NOT_FOUND / NOT_VISIBLE / DISABLED / COVERED.

### v1.7.5 — Batch body auto-scroll
- 360px max-height + smooth scroll. Custom 4px accent scrollbar.

### v1.7.4 — Glassmorphism chat bubbles (Option E)
- User pill (gradient accent + blur), assistant accent bar (full-width prose, no card).

### v1.7.3 — Hybrid timeline (Option E)
- ONE batch per turn. `↻` separator between iterations. Auto-compact to mini chip on next turn.

### v1.7.2 — Live streaming animation revival
- item-slide-in overshoot, item-flash radial pulse, icon-success-pop, batch-celebrate, ticker-action-glow.

### v1.7.1 — DOM destroy timeline
- `.activity-batch` actually `.remove()` from DOM after collapse, not just hide. Eliminates phantom blank space.

### v1.7.0 — DX milestone
- TypeScript foundation (`tsconfig.json` + `@ts-check`)
- Hot reload (`scripts/dev-watch.js` + SW WS client)
- SW keep-alive (`chrome.alarms` 25s ticks)
- `lastChatId` session persistence
- `tools_version` header in system prompt
- Tracelog ring buffer (`/dump-trace`)

---

## [1.6.x] — Mid May 2026 — Tool maturity

### v1.6.2 — Trusted Types fix + download_status + click(wait_navigation)
- `execute_js` 3-tier fallback: ISOLATED → MAIN (with TT policy) → CDP `Runtime.evaluate` with `allowUnsafeEvalBlockedByCSP`.
- `download_file` now waits for terminal state by default. `download_status({id})` for polling.
- `click({wait_navigation: true})` auto-waits for SPA settle.

### v1.6.1 — Timeline + form polish
- `auto-compact` true layout collapse (max-height + opacity transition)
- `fill_form` custom UI: pointerdown→mousedown→pointerup→mouseup→click sequence
- `extract_form_data` now includes per-field CSS selector
- `focus="player"` preset for YouTube /watch

### v1.6.0 — Storage refactor
- `safeStorageSet` + `sanitize` + IDB blob store. Quota-safe.

---

## Earlier versions

For pre-1.6 history, see git log: `git log --oneline v1.0..v1.5.0`.

---

## Versioning notes

- **Major bump (1.x → 2.0)**: Breaking removal of chat mode in v2.0.0. Users with chat-mode workflows must migrate to agent mode.
- **Tool count parity**: `mcp-bridge/src/tools.json` MUST match `case '...'` switch in `custom-ext/lib/tools.js`. Drift checks run before every commit.
- **System prompt versioning**: `MoonBridge tools_version: <manifest.version>` is auto-prepended to every system prompt so resumed conversations know what tool API they're talking to.
