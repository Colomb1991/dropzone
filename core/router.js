// @ts-check
// Hash router. The boot gates (viewer → open route → not primary → iOS tab → onboarding) belong to
// boot.js, which reads resolve() and RouteDef.open.
import * as log from './log.js';
import { parseHash, matchRoute, buildHash } from './pure/route-match.js';

/** @typedef {import('./types.js').RouteDef} RouteDef */
/** @typedef {{name:string, path:string, params:Record<string,string>, query:Record<string,string>,
 *   def:RouteDef|null}} Route */

/** @type {RouteDef[]} */
let defs = [];
/** @type {Route} */
let cur = { name: '/', path: '/', params: {}, query: {}, def: null };
const listeners = new Set();
let pushed = 0;
let started = false;

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
    history.replaceState(null, '', hash);
    update();
  } else if (location.hash === hash) {
    update();
  } else {
    pushed++;
    location.hash = hash;
  }
}

/** history.back() if the app pushed an entry, else navigate(fallback ?? '/'). */
export function back(fallback) {
  if (pushed > 0 && typeof history !== 'undefined') {
    pushed--;
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
