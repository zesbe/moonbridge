#!/usr/bin/env node
// MoonBridge MCP bridge entry point.
// Claude Code spawns this via stdio; we expose MoonBridge's browser tools as MCP tools.

import { startBridge } from '../src/server.js';

startBridge().catch((err) => {
  console.error('[moonbridge-bridge] fatal:', err);
  process.exit(1);
});
