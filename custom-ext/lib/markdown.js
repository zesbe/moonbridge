// Tiny markdown renderer: code blocks (fenced), inline code, bold, italic, lists, links, line breaks
// No external deps. XSS-safe via createElement/textContent.

import { renderCode } from './highlight.js';

export function renderMarkdown(text, container) {
  container.replaceChildren();
  if (!text) return;

  const lines = text.split('\n');
  let i = 0;
  let para = [];

  const flushPara = () => {
    if (para.length === 0) return;
    const p = document.createElement('p');
    appendInline(p, para.join('\n'));
    container.appendChild(p);
    para = [];
  };

  const flushList = (items, ordered) => {
    const list = document.createElement(ordered ? 'ol' : 'ul');
    for (const item of items) {
      const li = document.createElement('li');
      appendInline(li, item);
      list.appendChild(li);
    }
    container.appendChild(list);
  };

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      flushPara();
      const lang = fence[1] || '';
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      if (lang) code.className = `lang-${lang}`;
      const codeText = codeLines.join('\n');
      // Apply syntax highlighting (no-op for unsupported langs)
      try { renderCode(code, codeText, lang); }
      catch { code.textContent = codeText; }
      pre.appendChild(code);

      // copy button
      const copy = document.createElement('button');
      copy.className = 'copy-btn';
      copy.textContent = 'Copy';
      copy.addEventListener('click', () => {
        navigator.clipboard.writeText(codeText);
        copy.textContent = 'Copied';
        setTimeout(() => (copy.textContent = 'Copy'), 1200);
      });
      const wrap = document.createElement('div');
      wrap.className = 'code-wrap';
      wrap.dataset.lang = lang || 'code';
      wrap.appendChild(copy);
      wrap.appendChild(pre);
      container.appendChild(wrap);
      continue;
    }

    // heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      const h = document.createElement(`h${heading[1].length}`);
      appendInline(h, heading[2]);
      container.appendChild(h);
      i++;
      continue;
    }

    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      flushList(items, false);
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      flushPara();
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      flushList(items, true);
      continue;
    }

    // blank line
    if (line.trim() === '') {
      flushPara();
      i++;
      continue;
    }

    // paragraph line
    para.push(line);
    i++;
  }
  flushPara();
}

function appendInline(parent, text) {
  // Tokenize: `code`, **bold**, *italic*, [link](url), \n
  const re = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)]+\))|(\n)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
    if (m[1]) {
      const c = document.createElement('code');
      c.textContent = m[1].slice(1, -1);
      parent.appendChild(c);
    } else if (m[2]) {
      const b = document.createElement('strong');
      b.textContent = m[2].slice(2, -2);
      parent.appendChild(b);
    } else if (m[3]) {
      const i = document.createElement('em');
      i.textContent = m[3].slice(1, -1);
      parent.appendChild(i);
    } else if (m[4]) {
      const linkMatch = m[4].match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const a = document.createElement('a');
        a.href = linkMatch[2];
        a.textContent = linkMatch[1];
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        parent.appendChild(a);
      }
    } else if (m[5]) {
      parent.appendChild(document.createElement('br'));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}
