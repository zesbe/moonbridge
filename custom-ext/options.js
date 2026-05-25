import { listModels, streamMessages } from './lib/api.js';

const $ = (id) => document.getElementById(id);

const fields = {
  baseUrl: $('baseUrl'),
  apiToken: $('apiToken'),
  defaultModel: $('defaultModel'),
  systemPrompt: $('systemPrompt'),
  temperature: $('temperature'),
  maxTokens: $('maxTokens'),
  cacheTtl: $('cacheTtl'),
  pinSidepanelToTab: $('pinSidepanelToTab'),
};

const providerPreset = $('providerPreset');
const modelList = $('modelList');
const modelDatalist = $('modelDatalist');
const modelHint = $('modelHint');
const status = $('status');

// Provider presets — Base URL, common models, expected token format
const PROVIDERS = {
  freemodel: {
    name: 'FreeModel.dev (Claude Code CLI only ⚠)',
    baseUrl: 'https://cc.freemodel.dev/v1',
    models: [
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'claude-opus-4-6',
      'claude-haiku-4-5-20251001',
    ],
    defaultModel: 'claude-sonnet-4-6',
    tokenFormat: 'fe_oa_...',
    keyHelpUrl: 'https://freemodel.dev',
    warning: 'FreeModel.dev cc.freemodel.dev is scoped to Claude Code CLI traffic and may reject browser requests with "Please use Claude Code CLI". MoonBridge tries to mimic CLI headers but they may still gate on TLS fingerprint. If rejected, use OpenRouter or 9Router instead.',
  },
  '9router': {
    name: '9Router',
    baseUrl: 'https://rck8ncp.abc-tunnel.us/v1',
    models: [
      'kr/claude-sonnet-4.5',
      'kr/claude-haiku-4.5',
      'kr/claude-opus-4.7',
    ],
    defaultModel: 'kr/claude-sonnet-4.5',
    tokenFormat: 'sk-...',
    keyHelpUrl: '',
  },
  anthropic: {
    name: 'Anthropic (direct)',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-1-20250805',
      'claude-haiku-4-5-20251001',
    ],
    defaultModel: 'claude-sonnet-4-5-20250929',
    tokenFormat: 'sk-ant-...',
    keyHelpUrl: 'https://console.anthropic.com/settings/keys',
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'anthropic/claude-sonnet-4.5',
      'anthropic/claude-opus-4.1',
      'anthropic/claude-haiku-4.5',
      'openai/gpt-5',
      'google/gemini-2.5-pro',
    ],
    defaultModel: 'anthropic/claude-sonnet-4.5',
    tokenFormat: 'sk-or-v1-...',
    keyHelpUrl: 'https://openrouter.ai/keys',
  },
  bedrock: {
    name: 'AWS Bedrock (proxy)',
    baseUrl: 'http://localhost:8000/v1',
    models: [
      'anthropic.claude-sonnet-4-5-20250929-v1:0',
      'anthropic.claude-opus-4-1-20250805-v1:0',
    ],
    defaultModel: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
    tokenFormat: 'AWS_ACCESS_KEY (via proxy)',
    keyHelpUrl: '',
  },
  litellm: {
    name: 'LiteLLM (self-hosted)',
    baseUrl: 'http://localhost:4000/v1',
    models: [
      'claude-sonnet-4-5',
      'gpt-4o',
      'gemini-2.0-pro',
    ],
    defaultModel: 'claude-sonnet-4-5',
    tokenFormat: 'sk-... (your LiteLLM key)',
    keyHelpUrl: 'https://docs.litellm.ai/',
  },
};

function setStatus(msg, kind) {
  status.textContent = msg || '';
  status.className = 'status' + (kind ? ' ' + kind : '');
}

// Auto-detect provider from current Base URL on load — for users who already
// configured manually before presets existed.
function detectProvider(baseUrl) {
  if (!baseUrl) return 'custom';
  for (const [key, p] of Object.entries(PROVIDERS)) {
    if (baseUrl.startsWith(p.baseUrl.replace(/\/v1$/, ''))) return key;
  }
  return 'custom';
}

function applyProviderPreset(key) {
  const p = PROVIDERS[key];
  if (!p) {
    // Custom — clear auto-fill, leave user values
    modelHint.textContent = '';
    fields.baseUrl.placeholder = 'https://your-endpoint.com/v1';
    return;
  }
  fields.baseUrl.value = p.baseUrl;
  fields.baseUrl.placeholder = p.baseUrl;
  // Only auto-fill default model if current model isn't already valid for this provider
  if (!fields.defaultModel.value || !p.models.some((m) => fields.defaultModel.value.includes(m.split('/').pop()))) {
    fields.defaultModel.value = p.defaultModel;
  }
  // Populate datalist for autocomplete
  modelDatalist.replaceChildren();
  for (const m of p.models) {
    const opt = document.createElement('option');
    opt.value = m;
    modelDatalist.appendChild(opt);
  }
  fields.apiToken.placeholder = p.tokenFormat || 'sk-...';
  modelHint.textContent = `${p.name}: ${p.models.length} models. ${p.keyHelpUrl ? 'Get key: ' + p.keyHelpUrl : ''}`;
}

async function load() {
  const { settings } = await chrome.storage.local.get(['settings']);
  const s = settings || {
    baseUrl: 'https://cc.freemodel.dev/v1',
    apiToken: '',
    defaultModel: 'claude-sonnet-4-6',
    systemPrompt: '',
    temperature: 1.0,
    maxTokens: 16384,
  };
  fields.baseUrl.value = s.baseUrl || '';
  fields.apiToken.value = s.apiToken || '';
  fields.defaultModel.value = s.defaultModel || '';
  fields.systemPrompt.value = s.systemPrompt || '';
  fields.temperature.value = s.temperature ?? 1.0;
  fields.maxTokens.value = s.maxTokens ?? 16384;
  fields.cacheTtl.value = s.cacheTtl || '5m';
  fields.pinSidepanelToTab.checked = s.pinSidepanelToTab !== false;

  // Auto-detect & set preset selector
  const detected = detectProvider(s.baseUrl);
  providerPreset.value = detected;
  if (detected !== 'custom') {
    // Just populate datalist + hint, don't overwrite user's saved values
    const p = PROVIDERS[detected];
    modelDatalist.replaceChildren();
    for (const m of p.models) {
      const opt = document.createElement('option');
      opt.value = m;
      modelDatalist.appendChild(opt);
    }
    modelHint.textContent = `${p.name}: ${p.models.length} known models. ${p.keyHelpUrl ? 'Get key: ' + p.keyHelpUrl : ''}`;
  }
}

// Auto-append /v1 if user pastes base URL without it
function normalizeBaseUrl(raw) {
  let url = raw.trim().replace(/\/+$/, '');
  if (!url) return '';
  // If user pasted up to /v1/messages, strip /messages
  url = url.replace(/\/messages\/?$/, '');
  // If no /v1 at end, try to detect — most endpoints want /v1
  if (!/\/v\d+$/.test(url)) {
    // Some providers (cc.freemodel.dev) work with /v1
    url = url + '/v1';
  }
  return url;
}

async function save() {
  const settings = {
    baseUrl: normalizeBaseUrl(fields.baseUrl.value),
    apiToken: fields.apiToken.value.trim(),
    defaultModel: fields.defaultModel.value.trim(),
    systemPrompt: fields.systemPrompt.value,
    temperature: parseFloat(fields.temperature.value) || 1.0,
    maxTokens: Math.min(32768, Math.max(256, parseInt(fields.maxTokens.value, 10) || 16384)),
    cacheTtl: fields.cacheTtl.value === '1h' ? '1h' : '5m',
    pinSidepanelToTab: !!fields.pinSidepanelToTab.checked,
  };
  if (!settings.baseUrl) {
    setStatus('Base URL is required.', 'err');
    return;
  }
  if (!settings.defaultModel) {
    setStatus('Default model is required.', 'err');
    return;
  }
  if (!settings.apiToken) {
    setStatus('API token is required.', 'err');
    return;
  }
  // Reflect normalized URL back to input so user sees what was saved
  fields.baseUrl.value = settings.baseUrl;
  await chrome.storage.local.set({ settings });
  setStatus(`Saved. Endpoint: ${settings.baseUrl} · Model: ${settings.defaultModel}`, 'ok');
}

async function loadModels() {
  const baseUrl = normalizeBaseUrl(fields.baseUrl.value);
  const apiToken = fields.apiToken.value.trim();
  if (!baseUrl || !apiToken) {
    setStatus('Set Base URL and API Token first.', 'err');
    return;
  }
  setStatus('Loading models from /models endpoint…');
  try {
    const models = await listModels({ baseUrl, apiToken });
    modelList.replaceChildren();
    for (const m of models) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      modelList.appendChild(opt);
    }
    modelList.classList.remove('hidden');
    setStatus(`Loaded ${models.length} models from server. Click one to select.`, 'ok');
  } catch (e) {
    // Fall back to preset list if /models endpoint missing (some proxies don't expose it)
    const preset = PROVIDERS[providerPreset.value];
    if (preset) {
      modelList.replaceChildren();
      for (const m of preset.models) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m + ' (preset)';
        modelList.appendChild(opt);
      }
      modelList.classList.remove('hidden');
      setStatus(`Server's /models endpoint failed (${e.message}). Showing preset list — click to use.`, 'err');
    } else {
      setStatus(`Failed: ${e.message}. Try a different Base URL or pick a Provider Preset.`, 'err');
    }
  }
}

async function testConnection() {
  const baseUrl = normalizeBaseUrl(fields.baseUrl.value);
  const apiToken = fields.apiToken.value.trim();
  const model = fields.defaultModel.value.trim();
  if (!baseUrl || !apiToken || !model) {
    setStatus('Fill Base URL, API Token, and Default Model first.', 'err');
    return;
  }
  setStatus(`Testing ${model} at ${baseUrl}…`);
  try {
    let gotText = false;
    let gotThinking = false;
    let usage = null;
    let stopReason = null;
    for await (const ev of streamMessages({
      baseUrl,
      apiToken,
      model,
      messages: [{ role: 'user', content: 'reply with the single word: ok' }],
      // v2.4.1: bump from 16 → 256 because thinking models (Opus 4.x, sonnet
      // with extended thinking) consume tokens in <thinking> block before
      // any text. 16 was getting eaten entirely by thinking → "no text" false negative.
      maxTokens: 256,
    })) {
      if (ev.type === 'text' && ev.data) gotText = true;
      if (ev.type === 'thinking' && ev.data) gotThinking = true;
      if (ev.type === 'usage') usage = ev.data;
      if (ev.type === 'stop_reason') stopReason = ev.data;
      if (ev.type === 'error') {
        // Provide hints based on error pattern
        const msg = String(ev.data || '');
        let hint = '';
        if (/401|403|invalid.*key|unauthorized/i.test(msg)) hint = ' → API key is wrong or expired.';
        else if (/404|model.*not.*found/i.test(msg)) hint = ' → Model name not recognized by this endpoint. Try Load List.';
        else if (/cors|cross-origin/i.test(msg)) hint = ' → CORS blocked. Some endpoints reject browser-origin requests; use a proxy.';
        else if (/network|fetch failed|connection/i.test(msg)) hint = ' → Network unreachable. Check Base URL and your internet.';
        else if (/max_tokens|too.*many.*tokens|context.*length/i.test(msg)) hint = ' → max_tokens too high for this model. Lower it.';
        setStatus(`✕ Error: ${msg}${hint}`, 'err');
        return;
      }
    }
    if (gotText) {
      const usageStr = usage ? ` · usage: in=${usage.input_tokens}, out=${usage.output_tokens}` : '';
      // v2.4.3: detect "Please use Claude Code CLI" reject pattern
      // FreeModel.dev sometimes returns 200 OK with reject text in body
      const lastEvents = []; // (we already streamed, can't re-read; rely on getStatus pattern)
      setStatus(`✓ Connection works. Model "${model}" responded${usageStr}.`, 'ok');
    } else if (gotThinking) {
      setStatus(`✓ Connection works (thinking mode). Model "${model}" produced reasoning but no final text in 256 tokens (extended thinking consumes lots). The endpoint is healthy — full conversations will work fine.`, 'ok');
    } else if (stopReason === 'max_tokens') {
      setStatus(`⚠ Connection works but model hit max_tokens (256) before responding. Model "${model}" may need extended thinking budget. Endpoint is healthy.`, 'ok');
    } else {
      const presetWarn = PROVIDERS[providerPreset.value]?.warning;
      const warnMsg = presetWarn ? `\n\n⚠ ${presetWarn}` : '';
      setStatus(`Connected but model "${model}" returned nothing (stop_reason=${stopReason || 'unknown'}). Try a different model or check Base URL.${warnMsg}`, 'err');
    }
  } catch (e) {
    setStatus(`✕ Error: ${e.message}`, 'err');
  }
}

// Wire events
$('saveBtn').addEventListener('click', save);
$('saveAsPresetBtn').addEventListener('click', saveAsPreset);
$('loadModelsBtn').addEventListener('click', loadModels);
$('testBtn').addEventListener('click', testConnection);

providerPreset.addEventListener('change', (e) => {
  applyProviderPreset(e.target.value);
});

modelList.addEventListener('change', () => {
  if (modelList.value) {
    // Strip "(preset)" suffix if shown
    fields.defaultModel.value = modelList.value.replace(/ \(preset\)$/, '');
  }
});

$('toggleToken').addEventListener('click', () => {
  const isPwd = fields.apiToken.type === 'password';
  fields.apiToken.type = isPwd ? 'text' : 'password';
  $('toggleToken').textContent = isPwd ? 'Hide' : 'Show';
});

// =====================================================================
// CONNECTION PRESETS (v2.5) — save unlimited account/endpoint combos
// =====================================================================

const PRESETS_KEY = 'connectionPresets';

// Provider icon shorthand for visual identification
const PRESET_ICONS = {
  freemodel: '🆓',
  '9router': '🌐',
  anthropic: '🤖',
  openrouter: '🔀',
  bedrock: '☁️',
  litellm: '⚙️',
  custom: '🔌',
};

async function loadConnectionPresets() {
  const { [PRESETS_KEY]: presets } = await chrome.storage.local.get([PRESETS_KEY]);
  return Array.isArray(presets) ? presets : [];
}

async function saveConnectionPresets(presets) {
  await chrome.storage.local.set({ [PRESETS_KEY]: presets });
}

async function saveAsPreset() {
  const name = prompt('Name this connection (e.g. "OpenRouter — work", "Anthropic personal"):',
    PROVIDERS[providerPreset.value]?.name || 'My Connection');
  if (!name || !name.trim()) return;

  const baseUrl = normalizeBaseUrl(fields.baseUrl.value);
  const apiToken = fields.apiToken.value.trim();
  const defaultModel = fields.defaultModel.value.trim();

  if (!baseUrl || !apiToken || !defaultModel) {
    setStatus('Fill Base URL, API Token, and Default Model first.', 'err');
    return;
  }

  const presets = await loadConnectionPresets();
  // If a preset with same name exists, overwrite
  const existing = presets.findIndex((p) => p.name === name.trim());
  const preset = {
    id: existing >= 0 ? presets[existing].id : 'pre_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    name: name.trim(),
    provider: providerPreset.value,
    baseUrl,
    apiToken,
    defaultModel,
    systemPrompt: fields.systemPrompt.value || '',
    temperature: parseFloat(fields.temperature.value) || 1.0,
    maxTokens: parseInt(fields.maxTokens.value, 10) || 16384,
    cacheTtl: fields.cacheTtl.value === '1h' ? '1h' : '5m',
    createdAt: existing >= 0 ? presets[existing].createdAt : Date.now(),
    lastUsedAt: Date.now(),
  };
  if (existing >= 0) presets[existing] = preset;
  else presets.push(preset);

  await saveConnectionPresets(presets);
  setStatus(`✓ ${existing >= 0 ? 'Updated' : 'Saved'} preset "${name}".`, 'ok');
  await renderPresets();
}

async function activatePreset(id) {
  const presets = await loadConnectionPresets();
  const p = presets.find((x) => x.id === id);
  if (!p) return;

  // Apply to fields
  fields.baseUrl.value = p.baseUrl;
  fields.apiToken.value = p.apiToken;
  fields.defaultModel.value = p.defaultModel;
  fields.systemPrompt.value = p.systemPrompt || '';
  fields.temperature.value = p.temperature ?? 1.0;
  fields.maxTokens.value = p.maxTokens ?? 16384;
  fields.cacheTtl.value = p.cacheTtl || '5m';
  providerPreset.value = p.provider || detectProvider(p.baseUrl);
  applyProviderPreset(providerPreset.value);

  // Persist as current settings
  const settings = {
    baseUrl: p.baseUrl,
    apiToken: p.apiToken,
    defaultModel: p.defaultModel,
    systemPrompt: p.systemPrompt || '',
    temperature: p.temperature ?? 1.0,
    maxTokens: p.maxTokens ?? 16384,
    cacheTtl: p.cacheTtl || '5m',
    pinSidepanelToTab: !!fields.pinSidepanelToTab.checked,
  };
  await chrome.storage.local.set({ settings });

  // Update lastUsedAt
  p.lastUsedAt = Date.now();
  await saveConnectionPresets(presets);

  setStatus(`✓ Activated "${p.name}". Endpoint + model + token applied.`, 'ok');
  await renderPresets();
}

async function deletePreset(id) {
  const presets = await loadConnectionPresets();
  const p = presets.find((x) => x.id === id);
  if (!p) return;
  if (!confirm(`Delete preset "${p.name}"?\n\nThis only removes the saved config — your current active connection stays.`)) return;
  const next = presets.filter((x) => x.id !== id);
  await saveConnectionPresets(next);
  setStatus(`Deleted preset "${p.name}".`, 'ok');
  await renderPresets();
}

async function renderPresets() {
  const presets = await loadConnectionPresets();
  const container = $('savedPresetsList');
  container.replaceChildren();

  if (!presets.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-presets';
    empty.style.color = 'var(--text-dim)';
    empty.style.padding = '12px 0';
    empty.innerHTML = 'No saved connections yet. Configure above, then click <strong>Save as Preset</strong>.';
    container.appendChild(empty);
    return;
  }

  // Sort by lastUsedAt (most recent first)
  const sorted = presets.slice().sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));

  // Get current active settings to mark which preset is active
  const { settings } = await chrome.storage.local.get(['settings']);
  const currentBase = (settings?.baseUrl || '').replace(/\/$/, '');
  const currentToken = settings?.apiToken || '';
  const currentModel = settings?.defaultModel || '';

  for (const p of sorted) {
    const isActive = p.baseUrl.replace(/\/$/, '') === currentBase &&
                     p.apiToken === currentToken &&
                     p.defaultModel === currentModel;

    const item = document.createElement('div');
    item.className = 'preset-item' + (isActive ? ' active' : '');

    const icon = document.createElement('div');
    icon.className = 'preset-icon';
    icon.textContent = PRESET_ICONS[p.provider] || '🔌';
    item.appendChild(icon);

    const info = document.createElement('div');
    info.className = 'preset-info';
    const name = document.createElement('div');
    name.className = 'preset-name';
    name.appendChild(document.createTextNode(p.name));
    if (isActive) {
      const badge = document.createElement('span');
      badge.className = 'preset-active-badge';
      badge.textContent = 'ACTIVE';
      name.appendChild(badge);
    }
    info.appendChild(name);
    const meta = document.createElement('div');
    meta.className = 'preset-meta';
    const tokenMask = p.apiToken ? p.apiToken.slice(0, 6) + '…' + p.apiToken.slice(-4) : '(no token)';
    meta.textContent = `${p.defaultModel} · ${tokenMask}`;
    meta.title = `${p.baseUrl}\n${p.defaultModel}\nToken: ${tokenMask}`;
    info.appendChild(meta);
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'preset-actions';
    const useBtn = document.createElement('button');
    useBtn.className = 'preset-btn activate';
    useBtn.textContent = isActive ? '✓ In use' : 'Use';
    useBtn.disabled = isActive;
    useBtn.addEventListener('click', () => activatePreset(p.id));
    actions.appendChild(useBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'preset-btn danger';
    delBtn.textContent = '🗑';
    delBtn.title = 'Delete preset';
    delBtn.addEventListener('click', () => deletePreset(p.id));
    actions.appendChild(delBtn);

    item.appendChild(actions);
    container.appendChild(item);
  }
}

load().then(() => renderPresets());
