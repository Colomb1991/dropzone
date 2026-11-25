// @ts-check
// Hash router. The boot gates (viewer → open route → not primary → iOS tab → onboarding) belong to
// boot.js, which reads resolve() and RouteDef.open.
import * as log from './log.js';
import { parseHash, matchRoute, buildHash, entryDepth } from './pure/route-match.js';

/** @typedef {import('./types.js').RouteDef} RouteDef */
/** @typedef {{name:string, path:string, params:Record<string,string>, query:Record<string,string>,
 *   def:RouteDef|null}} Route */

/** @type {RouteDef[]} */
let defs = [];
/** @type {Route} */
let cur = { name: '/', path: '/', params: {}, query: {}, def: null };
const listeners = new Set();
/** Depth of the entry shown in the app's own history; -1 before the first one (see entryDepth). */
let depth = -1;
let started = false;

/** Test doubles carry no `history.state`: there the depth stays where it is and back() falls back. */
const stateful = () => typeof history !== 'undefined' && 'state' in history;

/**
 * Numbers the history entry now shown, or reads the number it already has. This is what keeps
 * back() right after the system back or forward button, a tapped link, or a reload.
 */
function syncDepth() {
  if (!stateful()) return;
  try {
    const state = history.state;
    const next = entryDepth(depth, state);
    depth = next.depth;
    if (!next.stamp) return;
    const keep = state !== null && typeof state === 'object' ? state : {};
    history.replaceState({ ...keep, dz: depth }, '');
  } catch (err) {
    log.warn('router', 'state-failed');
  }
}

/** May be called several times (once per feature). */
export function defineRoutes(list) {
  defs.push(...list);
}

export function routes() {
  return [...defs];
}

/** Pure lookup: what a hash means with the routes defined so far. @returns {Route} */
export function resolve(hash) {
  const parsed = parseHash(hash);
  if (parsed.kind === 'alert') {
    const def = defs.find((d) => d.path === '@viewer') ?? null;
    return { name: 'viewer', path: '@viewer', params: { fragment: parsed.fragment }, query: {}, def };
  }
  const m = matchRoute(parsed.path, defs.map((d) => d.path));
  if (!m) return { name: '/', path: '/', params: {}, query: {}, def: defs.find((d) => d.path === '/') ?? null };
  const def = defs.find((d) => d.path === m.pattern) ?? null;
  return { name: m.pattern, path: parsed.path, params: m.params, query: parsed.query, def };
}

function update() {
  syncDepth();
  cur = resolve(typeof location === 'undefined' ? '' : location.hash);
  for (const cb of [...listeners]) {
    try {
      cb(cur);
    } catch (err) {
      log.error('router', err);
    }
  }
}

export function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('hashchange', update);
  update();
}

/** @param {string} path @param {{replace?:boolean, query?:Record<string,string>}} [opts] */
export function navigate(path, opts = {}) {
  const hash = buildHash(path, opts.query);
  if (typeof location === 'undefined') return;
  if (opts.replace) {
    // The entry keeps its number: replacing it does not make the history deeper.
    history.replaceState(stateful() ? history.state ?? null : null, '', hash);
    update();
  } else if (location.hash === hash) {
    update();
  } else {
    location.hash = hash;
  }
}

/**
 * history.back() when an entry of the app lies before this one, else navigate(fallback ?? '/').
 * The depth comes from the entries themselves, so a system back before this call is counted.
 */
export function back(fallback) {
  if (depth > 0 && typeof history !== 'undefined') {
    // Counted down at once: a double tap cannot walk out of the app. The hashchange sets the real value.
    depth--;
    history.back();
  } else {
    navigate(fallback ?? '/', { replace: true });
  }
}

/** '#/note/abc' */
export function href(path, query) {
  return buildHash(path, query);
}

/** @returns {Route} */
export function current() {
  return cur;
}

/** @param {(r:Route)=>void} cb @returns {() => void} */
export function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
