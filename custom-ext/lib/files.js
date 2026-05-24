// File handling: read user-picked files into attachment objects.
// Supported types:
//   - image/* (PNG, JPEG, GIF, WEBP)  → vision content block
//   - text/*, application/json, application/javascript, etc → text embed
//   - application/pdf                  → document content block (best-effort)
//
// An "attachment" object:
//   { id, name, mime, size, kind: 'image'|'text'|'pdf'|'unknown',
//     dataUrl?: string,         // for image preview
//     text?: string,            // for text files
//     base64?: string,          // for image/pdf raw data
//   }

export const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB per file
export const MAX_TEXT_CHARS = 200_000;

const TEXT_LIKE_RE = /^(text\/|application\/(json|xml|javascript|x-yaml|x-shellscript|sql|x-toml))/;
const TEXT_EXT_RE = /\.(txt|md|markdown|csv|tsv|json|xml|yaml|yml|toml|ini|conf|log|js|jsx|ts|tsx|py|rb|go|rs|c|h|cpp|java|cs|php|sh|bash|zsh|sql|html|css|scss|less|vue|svelte|env|gitignore|dockerfile)$/i;

export async function readFile(file) {
  if (!file) throw new Error('No file');
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name}: too large (${(file.size / 1024 / 1024).toFixed(1)} MB > 8 MB)`);
  }

  const id = 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const mime = file.type || guessMime(file.name);
  const base = { id, name: file.name, mime, size: file.size };

  if (mime.startsWith('image/')) {
    const dataUrl = await readAsDataURL(file);
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    return { ...base, kind: 'image', dataUrl, base64: m?.[2] || '', mime: m?.[1] || mime };
  }

  if (mime === 'application/pdf') {
    const dataUrl = await readAsDataURL(file);
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    return { ...base, kind: 'pdf', base64: m?.[2] || '', mime: 'application/pdf' };
  }

  if (TEXT_LIKE_RE.test(mime) || TEXT_EXT_RE.test(file.name)) {
    let text = await readAsText(file);
    let truncated = false;
    if (text.length > MAX_TEXT_CHARS) {
      text = text.slice(0, MAX_TEXT_CHARS);
      truncated = true;
    }
    return { ...base, kind: 'text', text, truncated };
  }

  // Unknown — try as text
  try {
    let text = await readAsText(file);
    if (!text || text.length === 0) throw new Error('empty');
    let truncated = false;
    if (text.length > MAX_TEXT_CHARS) {
      text = text.slice(0, MAX_TEXT_CHARS);
      truncated = true;
    }
    return { ...base, kind: 'text', text, truncated };
  } catch {
    throw new Error(`${file.name}: unsupported file type (${mime})`);
  }
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsDataURL(file);
  });
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsText(file);
  });
}

function guessMime(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    pdf: 'application/pdf',
    txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json',
    js: 'application/javascript', ts: 'text/plain', py: 'text/plain',
    html: 'text/html', css: 'text/css', xml: 'application/xml', yaml: 'application/x-yaml', yml: 'application/x-yaml',
  };
  return map[ext] || 'application/octet-stream';
}

// Convert attachments to Anthropic content blocks for a user message.
// Adds a final {type:'text', text: userText} block.
// Text files are inlined as fenced code blocks for the model to read.
export function buildUserContent(userText, attachments) {
  if (!attachments?.length) return userText;
  const blocks = [];
  const textParts = [];

  for (const a of attachments) {
    if (a.kind === 'image') {
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: a.mime || 'image/png', data: a.base64 },
      });
    } else if (a.kind === 'pdf') {
      blocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: a.base64 },
      });
    } else if (a.kind === 'text') {
      textParts.push(`<file name="${escapeAttr(a.name)}"${a.truncated ? ' truncated="true"' : ''}>\n${a.text}\n</file>`);
    }
  }

  // Combine: image/pdf blocks first, then a single text block with file embeds + user message
  const finalText = (textParts.length ? textParts.join('\n\n') + '\n\n' : '') + (userText || '');
  if (finalText.trim()) blocks.push({ type: 'text', text: finalText });

  return blocks;
}

function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

export function describeAttachments(atts) {
  if (!atts?.length) return '';
  return atts.map((a) => {
    const sz = a.size > 1024 ? (a.size / 1024).toFixed(1) + ' KB' : a.size + ' B';
    return `${kindIcon(a.kind)} ${a.name} (${sz})`;
  }).join(', ');
}

export function kindIcon(kind) {
  return ({ image: '🖼', text: '📝', pdf: '📄', unknown: '📎' })[kind] || '📎';
}
