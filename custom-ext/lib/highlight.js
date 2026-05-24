// Lightweight, dependency-free syntax highlighter for code blocks.
// Supports: js/ts, jsx/tsx, python, html/xml, css/scss, json, bash/shell,
// go, rust, sql, yaml, markdown.
//
// Returns a DocumentFragment with <span class="hl-*"> tokens. Safe (no innerHTML
// from user input — we tokenize then build DOM nodes).

const KEYWORDS = {
  js: 'async await break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new null of return static super switch this throw try typeof undefined var void while with yield true false',
  ts: 'as async await break case catch class const continue declare debugger default delete do else enum export extends finally for from function if implements import in instanceof interface let module namespace new null of private protected public readonly return static super switch this throw try type typeof undefined var void while with yield true false abstract any boolean number string never unknown',
  py: 'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield self True False None match case',
  go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil iota',
  rs: 'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while async await dyn',
  sql: 'SELECT FROM WHERE AND OR NOT NULL IS IN AS JOIN INNER LEFT RIGHT OUTER ON GROUP BY ORDER HAVING LIMIT OFFSET INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE INDEX VIEW DROP ALTER ADD COLUMN PRIMARY KEY FOREIGN REFERENCES DEFAULT UNIQUE CHECK CONSTRAINT TRUE FALSE CASE WHEN THEN ELSE END',
  bash: 'if then else elif fi case esac for while do done in function return break continue export source local readonly set unset echo printf cd ls pwd cat grep awk sed find xargs',
  css: 'important inherit initial unset auto none',
};

const LANG_ALIASES = {
  javascript: 'js', ecmascript: 'js', node: 'js', nodejs: 'js',
  typescript: 'ts', tsx: 'ts', jsx: 'js',
  python: 'py', python3: 'py',
  shell: 'bash', sh: 'bash', zsh: 'bash',
  golang: 'go',
  rust: 'rs',
  yml: 'yaml',
  htm: 'html', xml: 'html',
  scss: 'css', less: 'css',
  md: 'markdown',
};

function normalizeLang(l) {
  if (!l) return '';
  const k = l.toLowerCase();
  return LANG_ALIASES[k] || k;
}

// Tokenizer: each entry = [regex, classNameOrFn]. Regexes must have ^ implicit
// (we slice the string as we consume).
const COMMON_PATTERNS = {
  js: [
    [/^\/\/[^\n]*/, 'comment'],
    [/^\/\*[\s\S]*?\*\//, 'comment'],
    [/^"(?:\\.|[^"\\])*"/, 'string'],
    [/^'(?:\\.|[^'\\])*'/, 'string'],
    [/^`(?:\\.|[^`\\])*`/, 'string'],
    [/^\/(?:\\.|[^\/\\\n])+\/[gimsuy]*/, 'regex'],
    [/^\b(0x[0-9a-fA-F]+|0b[01]+|\d+\.?\d*(?:[eE][+-]?\d+)?n?)\b/, 'number'],
    [/^\b([A-Z][a-zA-Z0-9_]*)\b/, 'class'],
    [/^([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*\()/, 'function'],
    [/^[a-zA-Z_$][a-zA-Z0-9_$]*/, 'word'],
    [/^[+\-*/%=<>!&|^~?:]+/, 'operator'],
    [/^[{}[\]().,;]/, 'punct'],
    [/^\s+/, null],
    [/^./, null],
  ],
  py: [
    [/^#[^\n]*/, 'comment'],
    [/^"""[\s\S]*?"""/, 'string'],
    [/^'''[\s\S]*?'''/, 'string'],
    [/^"(?:\\.|[^"\\])*"/, 'string'],
    [/^'(?:\\.|[^'\\])*'/, 'string'],
    [/^\b\d+\.?\d*(?:[eE][+-]?\d+)?j?\b/, 'number'],
    [/^@[a-zA-Z_][a-zA-Z0-9_]*/, 'decorator'],
    [/^\b([A-Z][a-zA-Z0-9_]*)\b/, 'class'],
    [/^([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*\()/, 'function'],
    [/^[a-zA-Z_][a-zA-Z0-9_]*/, 'word'],
    [/^[+\-*/%=<>!&|^~]+/, 'operator'],
    [/^[{}[\]().,;:]/, 'punct'],
    [/^\s+/, null],
    [/^./, null],
  ],
  bash: [
    [/^#[^\n]*/, 'comment'],
    [/^"(?:\\.|[^"\\])*"/, 'string'],
    [/^'(?:\\.|[^'\\])*'/, 'string'],
    [/^\$\{[^}]+\}/, 'variable'],
    [/^\$[a-zA-Z_][a-zA-Z0-9_]*/, 'variable'],
    [/^\$\d+/, 'variable'],
    [/^\b\d+\b/, 'number'],
    [/^--?[a-zA-Z][a-zA-Z0-9-]*/, 'flag'],
    [/^[a-zA-Z_][a-zA-Z0-9_]*/, 'word'],
    [/^[|&;<>()$`]+/, 'operator'],
    [/^\s+/, null],
    [/^./, null],
  ],
  json: [
    [/^"(?:\\.|[^"\\])*"(?=\s*:)/, 'key'],
    [/^"(?:\\.|[^"\\])*"/, 'string'],
    [/^\b(true|false|null)\b/, 'keyword'],
    [/^-?\d+\.?\d*(?:[eE][+-]?\d+)?/, 'number'],
    [/^[{}[\]:,]/, 'punct'],
    [/^\s+/, null],
    [/^./, null],
  ],
  css: [
    [/^\/\*[\s\S]*?\*\//, 'comment'],
    [/^"(?:\\.|[^"\\])*"/, 'string'],
    [/^'(?:\\.|[^'\\])*'/, 'string'],
    [/^@[a-zA-Z-]+/, 'decorator'],
    [/^#[a-fA-F0-9]{3,8}\b/, 'number'],
    [/^-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg|fr|ch|ex|pt|cm|mm|in)?\b/, 'number'],
    [/^([.#&][a-zA-Z_-][\w-]*|::?[a-zA-Z-]+|\[[^\]]+\])/, 'selector'],
    [/^([a-zA-Z-]+)(?=\s*:)/, 'property'],
    [/^[a-zA-Z-][a-zA-Z0-9_-]*/, 'word'],
    [/^[{}();,:>+~]/, 'punct'],
    [/^\s+/, null],
    [/^./, null],
  ],
  html: [
    [/^<!--[\s\S]*?-->/, 'comment'],
    [/^<!\w[^>]*>/, 'doctype'],
    [/^<\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/, 'tag-open'],
    [/^>/, 'tag-close'],
    [/^([a-zA-Z-:]+)(?==)/, 'attr'],
    [/^"(?:\\.|[^"\\])*"/, 'string'],
    [/^'(?:\\.|[^'\\])*'/, 'string'],
    [/^[=/]/, 'punct'],
    [/^\s+/, null],
    [/^./, null],
  ],
  yaml: [
    [/^#[^\n]*/, 'comment'],
    [/^"(?:\\.|[^"\\])*"/, 'string'],
    [/^'(?:\\.|[^'\\])*'/, 'string'],
    [/^([a-zA-Z_][\w-]*)(?=\s*:)/, 'key'],
    [/^\b(true|false|null|yes|no|on|off)\b/i, 'keyword'],
    [/^-?\d+\.?\d*\b/, 'number'],
    [/^[\[\]{}:,>|*&!]/, 'punct'],
    [/^[a-zA-Z][\w-]*/, 'word'],
    [/^\s+/, null],
    [/^./, null],
  ],
  markdown: [
    [/^#{1,6}[^\n]*/, 'heading'],
    [/^\*\*[^*]+\*\*/, 'bold'],
    [/^_[^_\n]+_/, 'italic'],
    [/^`[^`\n]+`/, 'inline-code'],
    [/^!\[[^\]]*\]\([^)]+\)/, 'link'],
    [/^\[[^\]]*\]\([^)]+\)/, 'link'],
    [/^>\s[^\n]*/, 'quote'],
    [/^[-*+]\s/, 'punct'],
    [/^\s+/, null],
    [/^./, null],
  ],
  sql: [
    [/^--[^\n]*/, 'comment'],
    [/^\/\*[\s\S]*?\*\//, 'comment'],
    [/^"(?:\\.|[^"\\])*"/, 'string'],
    [/^'(?:\\.|[^'\\])*'/, 'string'],
    [/^\b\d+\.?\d*\b/, 'number'],
    [/^[a-zA-Z_][\w]*/, 'word'],
    [/^[*=<>!,;()]/, 'punct'],
    [/^\s+/, null],
    [/^./, null],
  ],
};

// Use js patterns for ts/go/rs (similar shape, just different keyword set)
COMMON_PATTERNS.ts = COMMON_PATTERNS.js;
COMMON_PATTERNS.go = COMMON_PATTERNS.js;
COMMON_PATTERNS.rs = COMMON_PATTERNS.js;

export function highlight(code, lang) {
  const norm = normalizeLang(lang);
  const patterns = COMMON_PATTERNS[norm];
  const frag = document.createDocumentFragment();
  if (!patterns) {
    frag.appendChild(document.createTextNode(code));
    return frag;
  }
  const kwSet = new Set((KEYWORDS[norm] || '').split(/\s+/));
  let s = code;
  while (s.length) {
    let matched = false;
    for (const [re, type] of patterns) {
      const m = re.exec(s);
      if (m && m.index === 0) {
        const token = m[0];
        s = s.slice(token.length);
        let cls = type;
        if (type === 'word' && kwSet.has(token)) cls = 'keyword';
        if (type === 'tag-open') {
          // Render < and / as punct, then tag name as 'tag'
          const lead = token.match(/^<\/?\s*/)[0];
          const name = token.slice(lead.length);
          frag.appendChild(span('punct', lead));
          frag.appendChild(span('tag', name));
          matched = true;
          break;
        }
        if (cls) frag.appendChild(span(cls, token));
        else frag.appendChild(document.createTextNode(token));
        matched = true;
        break;
      }
    }
    if (!matched) {
      frag.appendChild(document.createTextNode(s[0]));
      s = s.slice(1);
    }
  }
  return frag;
}

function span(cls, text) {
  const el = document.createElement('span');
  el.className = 'hl-' + cls;
  el.textContent = text;
  return el;
}

// Public: render highlighted code into a <code> element
export function renderCode(codeEl, source, lang) {
  codeEl.replaceChildren(highlight(source, lang));
}
