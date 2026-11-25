// @ts-check
// Parser for the Markdown subset of the legal pack (legal README 1): #, ##, paragraphs, - lists,
// **bold**, [text](url), > block quote, `code`. Output is plain data: the screen turns it into
// elements, so no markup from a file ever reaches the page as HTML.

/** @typedef {{t:'text'|'code', v:string} | {t:'bold', inl:Inline[]}
 *   | {t:'link', v:string, href:string, external:boolean}} Inline */
/** @typedef {{t:'h1'|'h2'|'p', inl:Inline[]} | {t:'ul', items:Inline[][]}
 *   | {t:'quote', blocks:Block[]}} Block */

const INLINE_RE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Links may only leave to https or mailto, or stay inside the app ('#/…'). */
export function safeHref(href) {
  return /^(https:\/\/|mailto:|#\/)/.test(href) ? href : null;
}

/** @param {string} text @returns {Inline[]} */
export function parseInline(text) {
  /** @type {Inline[]} */
  const out = [];
  let last = 0;
  const push = (v) => {
    if (v) out.push({ t: 'text', v });
  };
  for (const m of String(text).matchAll(INLINE_RE)) {
    const at = m.index ?? 0;
    push(text.slice(last, at));
    if (m[1] !== undefined) out.push({ t: 'bold', inl: parseInline(m[1]) });
    else if (m[2] !== undefined) out.push({ t: 'code', v: m[2] });
    else {
      const href = safeHref(m[4]);
      if (href) out.push({ t: 'link', v: m[3], href, external: !href.startsWith('#') });
      else push(m[3]);
    }
    last = at + m[0].length;
  }
  push(text.slice(last));
  return out;
}

/** @param {string} md @returns {Block[]} */
export function parseBlocks(md) {
  /** @type {Block[]} */
  const out = [];
  /** @type {string[]} */
  let para = [];
  /** @type {string[]} */
  let items = [];
  /** @type {string[]} */
  let quote = [];
  const flush = () => {
    if (para.length) out.push({ t: 'p', inl: parseInline(para.join(' ')) });
    if (items.length) out.push({ t: 'ul', items: items.map(parseInline) });
    if (quote.length) out.push({ t: 'quote', blocks: parseBlocks(quote.join('\n')) });
    para = [];
    items = [];
    quote = [];
  };
  for (const raw of String(md).replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (/^>/.test(line)) {
      if (para.length || items.length) flush();
      quote.push(line.replace(/^> ?/, ''));
    } else if (line.trim() === '') {
      flush();
    } else if (/^##\s+/.test(line)) {
      flush();
      out.push({ t: 'h2', inl: parseInline(line.replace(/^##\s+/, '')) });
    } else if (/^#\s+/.test(line)) {
      flush();
      out.push({ t: 'h1', inl: parseInline(line.replace(/^#\s+/, '')) });
    } else if (/^- /.test(line)) {
      if (para.length || quote.length) flush();
      items.push(line.slice(2));
    } else {
      if (items.length || quote.length) flush();
      para.push(line.trim());
    }
  }
  flush();
  return out;
}

/** Plain text of inline parts (page title, tests). @param {Inline[]} parts @returns {string} */
export function inlineText(parts) {
  return parts.map((p) => (p.t === 'bold' ? inlineText(p.inl) : p.v)).join('');
}

/** Replaces {{NAME}} with vars.NAME; unknown names stay as written. */
export function fill(text, vars) {
  return String(text).replace(/\{\{([A-Z_]+)\}\}/g, (all, name) =>
    (Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : all));
}

/** Names of the placeholders still in a text, sorted. */
export function placeholdersIn(text) {
  return [...new Set([...String(text).matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]))].sort();
}
