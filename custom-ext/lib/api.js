// API client - streams from Anthropic-compatible /v1/messages endpoint
//
// Two consumers:
//  - streamMessages(...)  : simple text/thinking/usage events for plain chat
//  - streamRich(...)      : full content-block stream supporting tool_use accumulation
//                           yields { type: 'block_open'|'text'|'thinking'|'tool_input'|
//                                     'block_close'|'usage'|'stop_reason'|'done'|'error', ... }

export async function* streamMessages(opts) {
  for await (const ev of streamRich(opts)) {
    if (ev.type === 'text' || ev.type === 'thinking' || ev.type === 'usage' || ev.type === 'done' || ev.type === 'error') {
      yield ev;
    }
  }
}

export async function* streamRich({
  baseUrl,
  apiToken,
  model,
  system,
  messages,
  tools,
  temperature,
  maxTokens,
  signal,
}) {
  const url = `${baseUrl.replace(/\/$/, '')}/messages`;

  const body = {
    model,
    max_tokens: maxTokens || 16384,
    messages,
    stream: true,
  };
  if (system) {
    if (typeof system === 'string' && system.trim()) body.system = system;
    else if (Array.isArray(system) && system.length) body.system = system;
  }
  if (typeof temperature === 'number') body.temperature = temperature;
  if (Array.isArray(tools) && tools.length) body.tools = tools;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
        'x-api-key': apiToken,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    yield { type: 'error', data: `Network error: ${e.message}` };
    return;
  }

  if (!res.ok) {
    let errText = '';
    try { errText = await res.text(); } catch {}
    yield { type: 'error', data: `HTTP ${res.status}: ${errText.slice(0, 1000)}` };
    return;
  }
  if (!res.body) {
    yield { type: 'error', data: 'No response body' };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const parsed = parseSseEvent(raw);
        if (!parsed) continue;
        for (const out of mapRich(parsed)) yield out;
      }
    }
    if (buffer.trim()) {
      const parsed = parseSseEvent(buffer);
      if (parsed) for (const out of mapRich(parsed)) yield out;
    }
    yield { type: 'done' };
  } catch (e) {
    if (e.name === 'AbortError') yield { type: 'done', data: 'aborted' };
    else yield { type: 'error', data: `Stream error: ${e.message}` };
  }
}

function parseSseEvent(raw) {
  const lines = raw.split('\n');
  let event = null;
  let data = '';
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data || data === '[DONE]') return null;
  try { return { event, data: JSON.parse(data) }; } catch { return null; }
}

function* mapRich({ event, data }) {
  const t = data.type || event;
  switch (t) {
    case 'content_block_start': {
      const block = data.content_block || {};
      if (block.type === 'tool_use') {
        yield { type: 'block_open', index: data.index, block: { type: 'tool_use', id: block.id, name: block.name } };
      } else if (block.type === 'thinking') {
        yield { type: 'block_open', index: data.index, block: { type: 'thinking' } };
      } else if (block.type === 'text') {
        yield { type: 'block_open', index: data.index, block: { type: 'text' } };
      }
      return;
    }
    case 'content_block_delta': {
      const d = data.delta;
      if (!d) return;
      if (d.type === 'text_delta') yield { type: 'text', index: data.index, data: d.text || '' };
      else if (d.type === 'thinking_delta') yield { type: 'thinking', index: data.index, data: d.thinking || '' };
      else if (d.type === 'input_json_delta') yield { type: 'tool_input', index: data.index, data: d.partial_json || '' };
      return;
    }
    case 'content_block_stop': {
      yield { type: 'block_close', index: data.index };
      return;
    }
    case 'message_delta': {
      if (data.delta?.stop_reason) yield { type: 'stop_reason', data: data.delta.stop_reason };
      if (data.usage) yield { type: 'usage', data: data.usage };
      return;
    }
    case 'message_start':
    case 'message_stop':
    case 'ping':
      return;
    case 'error':
      yield { type: 'error', data: data.error?.message || JSON.stringify(data) };
      return;
  }
}

export async function listModels({ baseUrl, apiToken }) {
  const url = `${baseUrl.replace(/\/$/, '')}/models`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiToken}`, 'x-api-key': apiToken },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json.data || []).map((m) => m.id).sort();
}
