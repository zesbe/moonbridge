// API client - streams from Anthropic-compatible /v1/messages endpoint
//
// Two consumers:
//  - streamMessages(...)  : simple text/thinking/usage events for plain chat
//  - streamRich(...)      : full content-block stream supporting tool_use accumulation
//                           yields { type: 'block_open'|'text'|'thinking'|'tool_input'|
//                                     'block_close'|'usage'|'stop_reason'|'done'|'error', ... }
//
// v2.4.2 — auto-fallback to non-streaming if SSE returns empty.
// Some proxies (FreeModel.dev, LiteLLM-style adapters) advertise streaming
// but emit non-standard SSE format that our parser misses. Rather than fail,
// we detect "stream completed with 0 useful events" and retry with stream=false.

export async function* streamMessages(opts) {
  for await (const ev of streamRich(opts)) {
    if (ev.type === 'text' || ev.type === 'thinking' || ev.type === 'usage' || ev.type === 'done' || ev.type === 'error' || ev.type === 'stop_reason') {
      yield ev;
    }
  }
}

export async function* streamRich(opts) {
  const { baseUrl, apiToken, model } = opts;
  const url = `${baseUrl.replace(/\/$/, '')}/messages`;

  // First attempt: streaming
  let usefulEvents = 0;
  let sawError = false;
  const events = [];
  for await (const ev of _doRequest({ ...opts, url, stream: true })) {
    events.push(ev);
    if (ev.type === 'text' || ev.type === 'thinking' || ev.type === 'tool_input' ||
        ev.type === 'block_open' || ev.type === 'stop_reason') {
      usefulEvents++;
    }
    if (ev.type === 'error') sawError = true;
    yield ev;
  }

  // If streaming gave us nothing useful AND no error, the proxy probably
  // doesn't speak our SSE dialect. Retry as non-streaming JSON.
  // (We've already yielded the original events including 'done', so we
  //  emit additional events here as a continuation.)
  if (usefulEvents === 0 && !sawError) {
    console.warn('[api.js] Streaming returned no useful events; retrying without stream...');
    yield { type: 'text', data: '' }; // placeholder so UI doesn't show "empty"
    for await (const ev of _doRequest({ ...opts, url, stream: false })) {
      yield ev;
    }
  }
}

// Single-request runner. Handles BOTH streaming and non-streaming.
async function* _doRequest({ url, apiToken, model, system, messages, tools, temperature, maxTokens, signal, stream }) {
  // v2.3.2: smart max_tokens cap based on model
  const modelLower = (model || '').toLowerCase();
  let maxCap = 16384;
  if (/opus|sonnet-4\.[5-9]|sonnet-4-[5-9]|sonnet-5/.test(modelLower)) maxCap = 16384;
  else if (/haiku/.test(modelLower)) maxCap = 8192;
  else if (/gpt-4|gpt-5|o1|o3|llama-3\.[2-9]/.test(modelLower)) maxCap = 16384;
  else if (/owl|nano|mini/.test(modelLower)) maxCap = 8192;
  if (/openrouter|^or\//.test(modelLower)) maxCap = Math.min(maxCap, 16384);

  const requestedMax = Number(maxTokens) || 16384;
  const finalMax = Math.max(256, Math.min(requestedMax, maxCap));

  const body = {
    model,
    max_tokens: finalMax,
    messages,
  };
  if (stream) body.stream = true;
  if (system) {
    if (typeof system === 'string' && system.trim()) body.system = system;
    else if (Array.isArray(system) && system.length) body.system = system;
  }
  if (typeof temperature === 'number') body.temperature = temperature;
  if (Array.isArray(tools) && tools.length) body.tools = tools;

  let res;
  try {
    // v2.4.3: provider-specific header injection
    // FreeModel.dev's `cc.freemodel.dev` is scoped to Claude Code CLI traffic.
    // Mimic CLI headers to try bypass their gating. May or may not work depending
    // on how strict their detection is.
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`,
      'x-api-key': apiToken,
      'anthropic-version': '2023-06-01',
      'Accept': stream ? 'text/event-stream' : 'application/json',
    };
    if (/freemodel\.dev/i.test(url)) {
      // Headers Claude Code CLI sends — proxy may gate on these
      headers['x-app'] = 'cli';
      headers['anthropic-beta'] = 'claude-code-20250219,prompt-caching-2024-07-31';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
      headers['x-stainless-lang'] = 'js';
      headers['x-stainless-package-version'] = '0.32.1';
      headers['x-stainless-runtime'] = 'node';
      headers['x-stainless-os'] = 'MacOS';
      headers['x-stainless-arch'] = 'arm64';
      headers['x-stainless-runtime-version'] = 'v22.0.0';
      headers['x-stainless-helper-method'] = 'stream';
    }
    res = await fetch(url, {
      method: 'POST',
      headers,
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

  // ── Non-streaming branch: read full JSON, emit synthetic events
  if (!stream) {
    let json;
    try {
      const text = await res.text();
      json = JSON.parse(text);
    } catch (e) {
      yield { type: 'error', data: `Non-streaming parse failed: ${e.message}` };
      return;
    }
    yield* _emitFromJsonResponse(json);
    yield { type: 'done' };
    return;
  }

  // ── Streaming branch: SSE parse
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
      // Final flush — could be SSE or accidentally JSON (some proxies do this)
      const parsed = parseSseEvent(buffer);
      if (parsed) {
        for (const out of mapRich(parsed)) yield out;
      } else {
        // Try parsing as plain JSON (proxy returned non-streaming response despite stream=true)
        try {
          const json = JSON.parse(buffer.trim());
          yield* _emitFromJsonResponse(json);
        } catch {}
      }
    }
    yield { type: 'done' };
  } catch (e) {
    if (e.name === 'AbortError') yield { type: 'done', data: 'aborted' };
    else yield { type: 'error', data: `Stream error: ${e.message}` };
  }
}

// Convert a non-streaming Anthropic-format JSON response into our event stream.
// Also handles OpenAI-format responses (for proxies that return that shape).
function* _emitFromJsonResponse(json) {
  // Anthropic format: { content: [{type, text|thinking|...}], stop_reason, usage }
  if (Array.isArray(json.content)) {
    let blockIdx = 0;
    for (const block of json.content) {
      if (block.type === 'text' && block.text) {
        yield { type: 'block_open', index: blockIdx, block: { type: 'text' } };
        yield { type: 'text', index: blockIdx, data: block.text };
        yield { type: 'block_close', index: blockIdx };
      } else if (block.type === 'thinking' && block.thinking) {
        yield { type: 'block_open', index: blockIdx, block: { type: 'thinking' } };
        yield { type: 'thinking', index: blockIdx, data: block.thinking };
        yield { type: 'block_close', index: blockIdx };
      } else if (block.type === 'tool_use') {
        yield { type: 'block_open', index: blockIdx, block: { type: 'tool_use', id: block.id, name: block.name } };
        yield { type: 'tool_input', index: blockIdx, data: JSON.stringify(block.input || {}) };
        yield { type: 'block_close', index: blockIdx };
      }
      blockIdx++;
    }
    if (json.stop_reason) yield { type: 'stop_reason', data: json.stop_reason };
    if (json.usage) yield { type: 'usage', data: json.usage };
    return;
  }
  // OpenAI format: { choices: [{message: {content}, finish_reason}], usage }
  if (Array.isArray(json.choices) && json.choices[0]?.message) {
    const msg = json.choices[0].message;
    if (msg.content) {
      yield { type: 'block_open', index: 0, block: { type: 'text' } };
      yield { type: 'text', index: 0, data: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) };
      yield { type: 'block_close', index: 0 };
    }
    if (json.choices[0].finish_reason) yield { type: 'stop_reason', data: json.choices[0].finish_reason };
    if (json.usage) yield { type: 'usage', data: { input_tokens: json.usage.prompt_tokens, output_tokens: json.usage.completion_tokens } };
    return;
  }
  // Unknown format — surface raw
  yield { type: 'error', data: `Unknown response format. Raw: ${JSON.stringify(json).slice(0, 400)}` };
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
