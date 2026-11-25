// @ts-check
// App state: memory only, never persisted. The last fix is not here (geo.lastFix()).
import * as log from './log.js';

/** @type {import('./types.js').AppState} */
let state = {
  ready: false, lang: 'it', theme: 'light', online: true, sandbox: false, primary: true,
  shift: null, onBreak: false, moving: false, fast: false, passenger: false,
  gps: { state: 'off', acc: null },
  wake: 'off', audio: 'locked', voice: 'locked',
  lastAlert: null, updateReady: false,
  storage: { persisted: null, pct: 0 },
};

/** @type {Set<{selector:Function, cb:Function, last:any}>} */
const subs = new Set();

/** @returns {import('./types.js').AppState} */
export function getState() {
  return state;
}

/**
 * Fires only when the selected value changes (Object.is).
 * @template T
 * @param {(s:import('./types.js').AppState)=>T} selector @param {(v:T)=>void} cb @returns {() => void}
 */
export function subscribe(selector, cb) {
  const sub = { selector, cb, last: selector(state) };
  subs.add(sub);
  return () => subs.delete(sub);
}

/** Core and ui/shell only. @param {Partial<import('./types.js').AppState>} patch */
export function setState(patch) {
  let changed = false;
  for (const k of Object.keys(patch)) {
    if (!Object.is(state[k], patch[k])) changed = true;
  }
  if (!changed) return;
  state = { ...state, ...patch };
  for (const sub of [...subs]) {
    let next;
    try {
      next = sub.selector(state);
      if (Object.is(next, sub.last)) continue;
      sub.last = next;
      sub.cb(next);
    } catch (err) {
      log.error('store', err);
    }
  }
}
