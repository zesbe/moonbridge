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

const modelList = $('modelList');
const status = $('status');

function setStatus(msg, kind) {
  status.textContent = msg || '';
  status.className = 'status' + (kind ? ' ' + kind : '');
}

async function load() {
  const { settings } = await chrome.storage.local.get(['settings']);
  const s = settings || {
    baseUrl: 'https://rck8ncp.abc-tunnel.us/v1',
    apiToken: '',
    defaultModel: 'kr/claude-sonnet-4.5',
    systemPrompt: '',
    temperature: 1.0,
    maxTokens: 4096,
  };
  fields.baseUrl.value = s.baseUrl || '';
  fields.apiToken.value = s.apiToken || '';
  fields.defaultModel.value = s.defaultModel || '';
  fields.systemPrompt.value = s.systemPrompt || '';
  fields.temperature.value = s.temperature ?? 1.0;
  fields.maxTokens.value = s.maxTokens ?? 4096;
  fields.cacheTtl.value = s.cacheTtl || '5m';
  fields.pinSidepanelToTab.checked = s.pinSidepanelToTab !== false;
}

async function save() {
  const settings = {
    baseUrl: fields.baseUrl.value.trim().replace(/\/$/, ''),
    apiToken: fields.apiToken.value.trim(),
    defaultModel: fields.defaultModel.value.trim(),
    systemPrompt: fields.systemPrompt.value,
    temperature: parseFloat(fields.temperature.value) || 1.0,
    maxTokens: parseInt(fields.maxTokens.value, 10) || 4096,
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
  await chrome.storage.local.set({ settings });
  setStatus('Saved.', 'ok');
}

async function loadModels() {
  const baseUrl = fields.baseUrl.value.trim().replace(/\/$/, '');
  const apiToken = fields.apiToken.value.trim();
  if (!baseUrl || !apiToken) {
    setStatus('Set Base URL and API Token first.', 'err');
    return;
  }
  setStatus('Loading models...');
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
    setStatus(`Loaded ${models.length} models. Click one to select.`, 'ok');
  } catch (e) {
    setStatus(`Failed: ${e.message}`, 'err');
  }
}

async function testConnection() {
  const baseUrl = fields.baseUrl.value.trim().replace(/\/$/, '');
  const apiToken = fields.apiToken.value.trim();
  const model = fields.defaultModel.value.trim();
  if (!baseUrl || !apiToken || !model) {
    setStatus('Fill Base URL, API Token, and Default Model first.', 'err');
    return;
  }
  setStatus('Testing...');
  try {
    let gotText = false;
    for await (const ev of streamMessages({
      baseUrl,
      apiToken,
      model,
      messages: [{ role: 'user', content: 'reply with the single word: ok' }],
      maxTokens: 16,
    })) {
      if (ev.type === 'text' && ev.data) gotText = true;
      if (ev.type === 'error') {
        setStatus(`Error: ${ev.data}`, 'err');
        return;
      }
    }
    if (gotText) setStatus('Connection works.', 'ok');
    else setStatus('Connected but no text. Model may be thinking-only or returned empty.', 'err');
  } catch (e) {
    setStatus(`Error: ${e.message}`, 'err');
  }
}

$('saveBtn').addEventListener('click', save);
$('loadModelsBtn').addEventListener('click', loadModels);
$('testBtn').addEventListener('click', testConnection);

modelList.addEventListener('change', () => {
  if (modelList.value) fields.defaultModel.value = modelList.value;
});

$('toggleToken').addEventListener('click', () => {
  const isPwd = fields.apiToken.type === 'password';
  fields.apiToken.type = isPwd ? 'text' : 'password';
  $('toggleToken').textContent = isPwd ? 'Hide' : 'Show';
});

load();
