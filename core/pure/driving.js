// @ts-check
// SPEC 5.1. Speeds in m/s.
export const SPEED_STOP = 1.4;
export const SPEED_MOVE = 2.2;
export const SPEED_FAST = 4.2;
const HITS = 3;
const STOP_AFTER_MS = 3000;
const NO_FIX_MS = 10000;

/** @typedef {{label:'stopped'|'moving'|'fast', n22:number, n42:number, below42:number,
 *   slowSince:number|null, lastTs:number|null,
 *   peak:number            // top speed of the current (or just ended) moving phase
 * }} DrivingState */

/** @returns {DrivingState} */
export function initialDrivingState() {
  return { label: 'stopped', n22: 0, n42: 0, below42: 0, slowSince: null, lastTs: null, peak: 0 };
}

function stopped(state, lastTs) {
  return { ...state, label: /** @type {'stopped'} */ ('stopped'), n22: 0, n42: 0, below42: 0, slowSince: null, lastTs };
}

/**
 * Call with every filtered fix, and with `fix = null` on the 1 Hz tick.
 * @param {DrivingState} state
 * @param {import('../types.js').Fix|null} fix
 * @param {number} now
 * @returns {DrivingState}
 */
export function drivingStep(state, fix, now) {
  if (!fix) {
    if (state.label === 'stopped') return state;
    if (state.lastTs !== null && now - state.lastTs >= NO_FIX_MS) return stopped(state, state.lastTs);
    if (state.slowSince !== null && now - state.slowSince >= STOP_AFTER_MS) return stopped(state, state.lastTs);
    return state;
  }
  const s = fix.speed;
  const known = typeof s === 'number';
  const is42 = known && s >= SPEED_FAST;
  const is22 = is42 || (known && s >= SPEED_MOVE && fix.acc <= 30);
  const slow = !known || s < SPEED_STOP;
  const next = {
    ...state,
    n22: is22 ? state.n22 + 1 : 0,
    n42: is42 ? state.n42 + 1 : 0,
    below42: is42 ? 0 : state.below42 + 1,
    slowSince: slow ? (state.slowSince ?? fix.ts) : null,
    lastTs: fix.ts,
  };
  if (state.label === 'stopped') {
    if (next.n42 >= HITS) return { ...next, label: 'fast', peak: s ?? 0, slowSince: null };
    if (next.n22 >= HITS) return { ...next, label: 'moving', peak: s ?? 0, slowSince: null };
    return { ...next, slowSince: null };
  }
  next.peak = Math.max(state.peak, known ? s : 0);
  if (next.slowSince !== null && fix.ts - next.slowSince >= STOP_AFTER_MS) return stopped(next, fix.ts);
  if (next.n42 >= HITS) next.label = 'fast';
  else if (state.label === 'fast' && next.below42 >= HITS) next.label = 'moving';
  return next;
}
