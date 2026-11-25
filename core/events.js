// @ts-check
// Closed list of events: ARCHITECTURE 2.4. Additions in Release 1: driving:changed carries
// {moving, fast, label}; break:ended carries {auto}; shift:resumed carries {stale}.
import * as log from './log.js';

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

/** @param {string} name @param {(payload:any)=>void} cb @returns {() => void} off */
export function on(name, cb) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  /** @type {Set<Function>} */ (listeners.get(name)).add(cb);
  return () => listeners.get(name)?.delete(cb);
}

/** @param {string} name @param {any} [payload] */
export function emit(name, payload = {}) {
  const set = listeners.get(name);
  if (!set) return;
  for (const cb of [...set]) {
    try {
      cb(payload);
    } catch (err) {
      log.error('events', err, { event: name });
    }
  }
}
