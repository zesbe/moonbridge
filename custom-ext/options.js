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
    name: 'FreeModel.dev',
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
    let usage = null;
    for await (const ev of streamMessages({
      baseUrl,
      apiToken,
      model,
      messages: [{ role: 'user', content: 'reply with the single word: ok' }],
      maxTokens: 16,
    })) {
      if (ev.type === 'text' && ev.data) gotText = true;
      if (ev.type === 'usage') usage = ev.data;
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
      setStatus(`✓ Connection works. Model "${model}" responded${usageStr}.`, 'ok');
    } else {
      setStatus('Connected but no text. Model may be thinking-only or returned empty. Try a different model.', 'err');
    }
  } catch (e) {
    setStatus(`✕ Error: ${e.message}`, 'err');
  }
}

// Wire events
$('saveBtn').addEventListener('click', save);
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

load();
