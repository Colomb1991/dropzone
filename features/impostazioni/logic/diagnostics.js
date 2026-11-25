// @ts-check
// Pure helpers of the Diagnostica screen: allowed hosts, and the text of "Copia risultati".

/** Hosts of the `connect-src` directive of a Content-Security-Policy ('self' excluded). */
export function hostsFromCsp(csp) {
  const part = String(csp ?? '').split(';').map((s) => s.trim()).find((s) => s.startsWith('connect-src '));
  if (!part) return [];
  const hosts = [];
  for (const src of part.split(/\s+/).slice(1)) {
    const m = /^https?:\/\/([^/\s]+)/.exec(src);
    if (m) hosts.push(m[1].toLowerCase());
  }
  return hosts;
}

/**
 * Hosts contacted in this session, split into the ones the app may contact and the others.
 * @param {string[]} urls resource URLs @param {string} ownHost @param {string[]} allowed
 * @returns {{known:string[], unknown:string[]}} sorted, own origin left out
 */
export function classifyHosts(urls, ownHost, allowed) {
  const ok = new Set(allowed.map((h) => h.toLowerCase()));
  const known = new Set();
  const unknown = new Set();
  for (const url of urls) {
    const m = /^https?:\/\/([^/?#]+)/i.exec(String(url));
    if (!m) continue;
    const host = m[1].toLowerCase();
    if (host === String(ownHost).toLowerCase()) continue;
    (ok.has(host) ? known : unknown).add(host);
  }
  return { known: [...known].sort(), unknown: [...unknown].sort() };
}

/** Megabytes with one decimal, as a number. */
export function megabytes(bytes) {
  const n = Number(bytes);
  return Number.isFinite(n) && n > 0 ? Math.round(n / 104857.6) / 10 : 0;
}

/** Anything that looks like a coordinate (4 or more decimals) is masked: the report never holds a position. */
export function maskPositions(text) {
  return String(text).replace(/-?\d{1,3}[.,]\d{4,}/g, '•••');
}

const MARK = { true: 'OK', false: 'NO', null: '--' };

/**
 * Text copied by "Copia risultati". No positions, no note text: rows hold only what the tests print,
 * and the debug log drops `lat`, `lon`, `text` and `number` at the source.
 * @param {{title:string, meta:[string, string][], rows:{label:string, ok:boolean|null, text:string}[],
 *   log:{ts:number, level:string, scope:string, code:string}[]}} r
 * @returns {string}
 */
export function reportText(r) {
  const lines = [r.title, ...r.meta.map(([k, v]) => `${k}: ${v}`), ''];
  for (const row of r.rows) lines.push(`[${MARK[String(row.ok)] ?? '--'}] ${row.label}: ${row.text}`);
  if (r.log.length) {
    lines.push('');
    for (const e of [...r.log].reverse().slice(0, 40)) {
      lines.push(`${new Date(e.ts).toISOString()} ${e.level} ${e.scope} ${e.code}`);
    }
  }
  return maskPositions(lines.join('\n'));
}
