// @ts-check
// The only source of "now". The demo shifts it with setOffset.
let offsetMs = 0;

export function now() {
  return Date.now() + offsetMs;
}

/** sandbox.js only. */
export function setOffset(ms) {
  offsetMs = Number.isFinite(ms) ? ms : 0;
}

/** Local midnight that ends the day of `ts`. */
export function nextMidnight(ts = now()) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}
