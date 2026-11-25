// @ts-check
import { distM } from './geo-math.js';

/** @typedef {{last:{lat:number, lon:number, acc:number, ts:number}|null, speeds:number[]}} FilterState */

/** @returns {FilterState} */
export function initialFilterState() {
  return { last: null, speeds: [] };
}

function median(list) {
  const s = [...list].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Release 1 stages: rate, teleport, speed (reported or derived, median of 3), usable.
 * @param {FilterState} state
 * @param {import('../types.js').RawFix} raw
 * @returns {{state: FilterState, fix: import('../types.js').Fix|null}}
 */
export function filterStep(state, raw) {
  if (!raw || !Number.isFinite(raw.lat) || !Number.isFinite(raw.lon) || !Number.isFinite(raw.ts)) {
    return { state, fix: null };
  }
  const acc = Number.isFinite(raw.acc) && raw.acc >= 0 ? raw.acc : 9999;
  const last = state.last;
  let derived = null;
  if (last) {
    const dt = raw.ts - last.ts;
    if (dt < 900) return { state, fix: null };
    const d = distM(last.lat, last.lon, raw.lat, raw.lon);
    if (d / (dt / 1000) > 70 && acc <= 100 && last.acc <= 100) return { state, fix: null };
    if (acc <= 30 && last.acc <= 30 && dt >= 1000 && dt <= 5000) derived = d / (dt / 1000);
  }
  const reported = typeof raw.speed === 'number' && Number.isFinite(raw.speed) && raw.speed >= 0;
  const speedNow = reported ? /** @type {number} */ (raw.speed) : derived;
  let speeds = state.speeds;
  let speed = null;
  if (speedNow !== null) {
    speeds = [...speeds, speedNow].slice(-3);
    speed = median(speeds);
  }
  const heading = typeof raw.heading === 'number' && Number.isFinite(raw.heading) ? raw.heading : null;
  return {
    state: { last: { lat: raw.lat, lon: raw.lon, acc, ts: raw.ts }, speeds },
    fix: {
      lat: raw.lat, lon: raw.lon, acc, speed, heading, ts: raw.ts,
      headingTs: null, usable: acc <= 100, sim: raw.sim === true,
    },
  };
}
