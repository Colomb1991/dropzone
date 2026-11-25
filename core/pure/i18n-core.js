// @ts-check
/** @typedef {Record<string, string | {one?:string, other:string}>} Dict */

/** Replaces {name}; unknown names stay as written. */
export function interpolate(tpl, params) {
  if (!params) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (all, name) =>
    (Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : all));
}

/** @param {string|{one?:string, other:string}} entry @param {number} count @param {string} lang */
export function pickPlural(entry, count, lang) {
  if (typeof entry === 'string') return entry;
  const cat = new Intl.PluralRules(lang).select(count);
  return entry[cat] ?? entry.other;
}

/** @param {{cur:Dict, fallback:Dict}} dicts @param {string} key */
export function resolve(dicts, key) {
  if (Object.prototype.hasOwnProperty.call(dicts.cur, key)) return dicts.cur[key];
  if (Object.prototype.hasOwnProperty.call(dicts.fallback, key)) return dicts.fallback[key];
  return undefined;
}

/** "Leggi i [[terms|Termini]]." → [{text:'Leggi i '}, {slot:'terms', text:'Termini'}, {text:'.'}] */
export function splitRich(tpl) {
  const parts = [];
  const re = /\[\[(\w+)\|([^\]]*)\]\]/g;
  let last = 0;
  let m = re.exec(tpl);
  while (m) {
    if (m.index > last) parts.push({ text: tpl.slice(last, m.index) });
    parts.push({ slot: m[1], text: m[2] });
    last = m.index + m[0].length;
    m = re.exec(tpl);
  }
  if (last < tpl.length) parts.push({ text: tpl.slice(last) });
  return parts;
}

/** Placeholder names of a template, sorted (used by the dictionary tests). */
export function placeholders(entry) {
  const text = typeof entry === 'string' ? entry : Object.values(entry).join(' ');
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
}
