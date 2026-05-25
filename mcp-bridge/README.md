# MoonBridge MCP Bridge

Connect [Claude Code CLI](https://docs.claude.com/claude-code) to the
[MoonBridge Chrome extension](../custom-ext/) so the model can drive your
browser from the terminal.

```
┌─────────────────────┐   stdio MCP    ┌──────────────────┐    WebSocket   ┌──────────────────┐
│   Claude Code CLI   │◄──────────────►│   This bridge    │◄──────────────►│  MoonBridge ext  │
│   (terminal)        │                │  (Node, stdio)   │   localhost    │  (Chrome)        │
└─────────────────────┘                └──────────────────┘                └──────────────────┘
```

## Install

```bash
# From this directory:
npm install
npm link    # makes `moonbridge-bridge` runnable globally

# Then add to Claude Code:
claude mcp add moonbridge --transport stdio moonbridge-bridge
```

## Use

1. Open Chrome and the MoonBridge sidepanel.
2. Click the small dot button in the top bar — it turns yellow (connecting),
   then green when the bridge picks up your session.
3. In any terminal: `claude` — every MoonBridge tool (159) is now available.

## Examples

```
$ claude
> What tabs do I have open?
🔧 moonbridge:list_tabs
✅ 5 tabs: …

> Read the GitHub tab and summarize the issue
🔧 moonbridge:read_tab(tab_id=…)
✅ Issue #42: …

> Click the merge button
🔧 moonbridge:click(selector="…")
✅ Clicked. URL is now: …
```

## Ports

Bridge listens on `127.0.0.1:9777`. Override with:

```bash
MOONBRIDGE_PORT=12345 moonbridge-bridge
```

The extension defaults to `ws://127.0.0.1:9777`. Match them.

## Notes

- The extension session is exclusive — only one Claude Code CLI session at a time.
- Tool calls from the CLI bypass the in-app approval modal.
- Memory/KB live inside the extension; the CLI can call `recall_memories`,
  `search_kb`, `remember`, etc just like the in-app agent.
