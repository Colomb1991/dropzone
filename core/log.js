// @ts-check
// Local debug log: a memory ring of 100 entries. Nothing is stored or sent.
import { now } from './clock.js';

const RING = 100;
const FORBIDDEN = new Set(['lat', 'lon', 'text', 'number']);
/** @type {{seq:number, ts:number, level:string, scope:string, code:string, data:object}[]} */
let ring = [];
let seq = 0;

function clean(data) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (FORBIDDEN.has(k)) continue;
    if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v;
    else if (typeof v === 'string' && v.length <= 40) out[k] = v;
  }
  return out;
}

function add(level, scope, code, data) {
  ring.push({ seq: ++seq, ts: now(), level, scope, code: String(code).slice(0, 60), data: clean(data) });
  if (ring.length > RING) ring = ring.slice(ring.length - RING);
}

export function info(scope, code, data) {
  add('info', scope, code, data);
}

export function warn(scope, code, data) {
  add('warn', scope, code, data);
}

/** @param {string} scope @param {unknown} err @param {object} [data] */
export function error(scope, err, data) {
  const e = /** @type {any} */ (err);
  const code = e && typeof e === 'object' ? (e.code ?? e.name ?? 'error') : String(err);
  add('error', scope, code, data);
}

/** Newest first; used by Diagnostics "Copia risultati". */
export async function exportText() {
  return [...ring].reverse().map((e) => {
    const d = Object.keys(e.data).length ? ` ${JSON.stringify(e.data)}` : '';
    return `${new Date(e.ts).toISOString()} ${e.level} ${e.scope} ${e.code}${d}`;
  }).join('\n');
}

export async function clearLog() {
  ring = [];
}

export function entries() {
  return [...ring];
}
