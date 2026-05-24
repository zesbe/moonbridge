// Scheduled tasks - cron-style prompts that run via chrome.alarms.
// Storage: chrome.storage.local 'scheduled'
//
// Task shape: {
//   id, name, prompt, mode, model, schedule: 'once'|'hourly'|'daily'|'weekly',
//   nextRunAt, enabled, lastRun: {at, success, output?, error?}
// }

const KEY = 'scheduled';
const ALARM_PREFIX = 'cc_sched_';

export const scheduledAdapter = {
  async list() {
    const { [KEY]: m } = await chrome.storage.local.get([KEY]);
    return Array.isArray(m) ? m : [];
  },
  async add({ name, prompt, mode = 'agent', model, schedule = 'daily', when }) {
    const items = await this.list();
    const id = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const task = {
      id, name, prompt, mode, model: model || null, schedule,
      enabled: true, createdAt: Date.now(),
      nextRunAt: computeNextRun(schedule, when || Date.now()),
      lastRun: null,
    };
    items.push(task);
    await chrome.storage.local.set({ [KEY]: items });
    await registerAlarm(task);
    return id;
  },
  async remove(id) {
    const items = await this.list();
    const next = items.filter((t) => t.id !== id);
    if (next.length === items.length) return false;
    await chrome.storage.local.set({ [KEY]: next });
    try { await chrome.alarms.clear(ALARM_PREFIX + id); } catch {}
    return true;
  },
  async toggle(id, enabled) {
    const items = await this.list();
    const t = items.find((x) => x.id === id);
    if (!t) return false;
    t.enabled = !!enabled;
    if (enabled) {
      t.nextRunAt = computeNextRun(t.schedule, Date.now());
      await registerAlarm(t);
    } else {
      try { await chrome.alarms.clear(ALARM_PREFIX + id); } catch {}
    }
    await chrome.storage.local.set({ [KEY]: items });
    return true;
  },
  async setLastRun(id, info) {
    const items = await this.list();
    const t = items.find((x) => x.id === id);
    if (!t) return;
    t.lastRun = { at: Date.now(), ...info };
    if (t.schedule !== 'once') {
      t.nextRunAt = computeNextRun(t.schedule, Date.now());
      await registerAlarm(t);
    } else {
      t.enabled = false;
    }
    await chrome.storage.local.set({ [KEY]: items });
  },
  async syncAlarms() {
    const items = await this.list();
    for (const t of items) {
      if (t.enabled) await registerAlarm(t);
    }
  },
};

function computeNextRun(schedule, fromMs) {
  const ms = (sec) => sec * 1000;
  switch (schedule) {
    case 'once': return fromMs + ms(60);                  // 1 min from now
    case 'hourly': return fromMs + ms(60 * 60);
    case 'daily': return fromMs + ms(60 * 60 * 24);
    case 'weekly': return fromMs + ms(60 * 60 * 24 * 7);
    default: return fromMs + ms(60 * 60 * 24);
  }
}

async function registerAlarm(task) {
  try {
    const when = task.nextRunAt;
    await chrome.alarms.create(ALARM_PREFIX + task.id, { when });
  } catch {}
}

export const ALARM_PREFIX_EXPORT = ALARM_PREFIX;
