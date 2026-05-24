// Service worker - handles sidepanel toggle, lifecycle, and scheduled task execution.

import { ALARM_PREFIX_EXPORT, scheduledAdapter } from './lib/scheduled.js';

// We MANUALLY handle action click instead of openPanelOnActionClick:true,
// so we can re-enable sidepanel on tabs that were pinned-out.
// chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
//   .catch((err) => console.error('setPanelBehavior failed:', err));

async function openSidepanelOnTab(tabId) {
  if (!tabId) return;
  try {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled: true,
    });
    await chrome.sidePanel.open({ tabId });
  } catch (e) {
    console.error('openSidepanelOnTab error:', e);
  }
}

// Click extension icon = open sidepanel on this specific tab
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  await openSidepanelOnTab(tab.id);
});

// Toggle via Ctrl+E command — also forces re-enable in case the tab was pinned-out
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-side-panel') return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await openSidepanelOnTab(tab.id);
  } catch (e) {
    console.error('toggle-side-panel error:', e);
  }
});

// Pin sidepanel to "primary" tab — disable on newly created tabs so the panel
// doesn't follow the user when they open a new tab via Ctrl+T or via agent.
// User can still summon it on any tab via the action icon or Ctrl+E.
chrome.tabs.onCreated.addListener(async (tab) => {
  try {
    const { settings } = await chrome.storage.local.get(['settings']);
    if (settings?.pinSidepanelToTab === false) return; // user disabled pinning
    if (!tab?.id) return;
    await chrome.sidePanel.setOptions({ tabId: tab.id, enabled: false });
  } catch {}
});

// Defaults on install
chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(['settings']);
  if (!cur.settings) {
    await chrome.storage.local.set({
      settings: {
        baseUrl: 'https://rck8ncp.abc-tunnel.us/v1',
        apiToken: '',
        defaultModel: 'kr/claude-sonnet-4.5',
        systemPrompt: '',
        temperature: 1.0,
        maxTokens: 4096,
        cacheTtl: '5m',
      },
    });
  }
  await scheduledAdapter.syncAlarms();
});

chrome.runtime.onStartup.addListener(async () => {
  await scheduledAdapter.syncAlarms();
});

// Handle scheduled task firings
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX_EXPORT)) return;
  const id = alarm.name.slice(ALARM_PREFIX_EXPORT.length);
  const tasks = await scheduledAdapter.list();
  const task = tasks.find((t) => t.id === id);
  if (!task || !task.enabled) return;
  // Show notification + open sidepanel with prompt prefilled
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Scheduled task',
      message: `Running: ${task.name}`,
      priority: 1,
    });
  } catch {}
  // Stash pending prompt for sidepanel to pick up
  await chrome.storage.local.set({ pendingScheduled: { id: task.id, prompt: task.prompt, mode: task.mode, model: task.model, ts: Date.now() } });
  // Try to open sidepanel on active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html', enabled: true });
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  } catch {}
  await scheduledAdapter.setLastRun(task.id, { triggered: true });
});

// =====================================================================
// Dev hot-reload (no-op in production)
// Connects to scripts/dev-watch.js via WebSocket on :9012 and triggers
// chrome.runtime.reload() on file change. Gated by version_name dev marker
// — production builds don't include "dev" so this is dead code there.
// =====================================================================
(function setupHotReload() {
  try {
    const m = chrome.runtime.getManifest();
    const isDev = !!m.version_name && /dev/i.test(m.version_name);
    if (!isDev) return;
    let ws = null;
    let backoff = 1000;
    const connect = () => {
      try {
        ws = new WebSocket('ws://localhost:9012');
      } catch (e) {
        scheduleReconnect();
        return;
      }
      ws.onopen = () => {
        backoff = 1000;
        console.log('[dev-reload] connected');
      };
      ws.onmessage = (ev) => {
        let data = ev.data;
        try { data = JSON.parse(data); } catch {}
        if (data === 'reload' || data?.type === 'reload') {
          console.log('[dev-reload] reloading…', data?.reason || '');
          chrome.runtime.reload();
        }
      };
      ws.onclose = scheduleReconnect;
      ws.onerror = () => { try { ws?.close(); } catch {} };
    };
    const scheduleReconnect = () => {
      const wait = Math.min(15000, backoff);
      backoff = Math.min(15000, backoff * 1.5);
      setTimeout(connect, wait);
    };
    connect();
  } catch (e) {
    // never break SW boot in prod
  }
})();

// =====================================================================
// SW keep-alive — chrome.alarms ticks at 25s intervals to keep the
// service worker from hibernating during long-running tools (monitor_url,
// download polling, etc). Cheap alarms have ~zero cost vs the alternative
// of every long tool dying mid-flight.
// Reference: https://developer.chrome.com/docs/extensions/reference/api/alarms
// =====================================================================
const KEEPALIVE_NAME = 'mb-keepalive';
chrome.alarms.create(KEEPALIVE_NAME, { periodInMinutes: 0.42 }); // ≈25s
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_NAME) {
    // Just touch storage — that's the cheapest thing that proves the SW is alive
    try { chrome.storage.session.set({ _mb_alive: Date.now() }); } catch {}
  }
});
