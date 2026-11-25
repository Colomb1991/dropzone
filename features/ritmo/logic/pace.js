// @ts-check
// Ritmo (SPEC 11): from two or three counts typed during the shift ("quante te ne mancano?") to a
// time back at the depot and the margin on the courier's own day. Pure: numbers in, numbers out.
// A forecast for the courier only. Nothing here is kept after the shift, nothing is a statistic.

/** @typedef {{at:number, left:number, plus?:boolean}} Checkpoint  `plus`: the rolling count of the +1 mode */
/** @typedef {{shiftId:string, checkpoints:Checkpoint[], updatedAt:number}} Pace */
/** @typedef {{startAt:number, endAt:number|null, plannedMin:number}} Break */

export const MIN_STOPS = 5;
export const MIN_WORKED_MIN = 20;
export const DEFAULT_RETURN_MIN = 25;
export const MAX_RETURN_MIN = 90;
export const MAX_LEFT = 400;
export const MAX_CHECKPOINTS = 12;
/** After this long without a new count the screen asks again (quietly). */
export const ASK_AGAIN_MIN = 120;
const MIN = 60000;

const isTs = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isLeft = (v) => Number.isInteger(v) && v >= 0 && v <= MAX_LEFT;

/** Setting `ritmo.returnMin`: 0 to 90 in steps of 5. */
export function validReturnMin(v) {
  return Number.isInteger(v) && v >= 0 && v <= MAX_RETURN_MIN && v % 5 === 0;
}

/** Digits typed on the keypad → a count, or null. */
export function parseLeft(digits) {
  if (!/^\d{1,3}$/.test(String(digits ?? ''))) return null;
  const n = Number(digits);
  return isLeft(n) ? n : null;
}

/** The stored record (store `kv`, key `ritmo.pace`). @returns {Pace|null} */
export function validatePace(rec) {
  if (!rec || typeof rec !== 'object' || typeof rec.shiftId !== 'string' || rec.shiftId === '') return null;
  if (!Array.isArray(rec.checkpoints)) return null;
  /** @type {Checkpoint[]} */
  const checkpoints = [];
  for (const c of rec.checkpoints) {
    if (!c || typeof c !== 'object' || !isTs(c.at) || !isLeft(c.left)) continue;
    checkpoints.push(c.plus === true ? { at: c.at, left: c.left, plus: true } : { at: c.at, left: c.left });
  }
  checkpoints.sort((a, b) => a.at - b.at);
  return { shiftId: rec.shiftId, checkpoints: checkpoints.slice(-MAX_CHECKPOINTS),
    updatedAt: isTs(rec.updatedAt) ? rec.updatedAt : 0 };
}

/** @param {string} shiftId @returns {Pace} */
export function emptyPace(shiftId) {
  return { shiftId, checkpoints: [], updatedAt: 0 };
}

function push(pace, cp) {
  let list = [...pace.checkpoints, cp];
  // The base (the first count taken on the road) always stays; the oldest in-between counts go.
  if (list.length > MAX_CHECKPOINTS) list = [list[0], ...list.slice(list.length - MAX_CHECKPOINTS + 1)];
  return { ...pace, checkpoints: list, updatedAt: cp.at };
}

/**
 * A count typed by the courier. The first one is the base `(t0, r0)`.
 * @param {Pace} pace @param {number} left @param {number} at @returns {Pace} the same object when refused
 */
export function addCheckpoint(pace, left, at) {
  if (!isLeft(left) || !isTs(at)) return pace;
  const last = pace.checkpoints[pace.checkpoints.length - 1];
  return push(pace, { at: last ? Math.max(at, last.at + 1) : at, left });
}

/**
 * "+1": one delivery done. The count of the +1 mode is one rolling checkpoint, moved at every tap,
 * so the pace is measured from the last typed count to now.
 * @param {Pace} pace @param {number} at @returns {Pace} the same object when there is nothing to count down
 */
export function plusOne(pace, at) {
  const last = pace.checkpoints[pace.checkpoints.length - 1];
  if (!last || last.left <= 0 || !isTs(at)) return pace;
  const cp = { at: Math.max(at, last.at + 1), left: last.left - 1, plus: true };
  if (last.plus) return { ...pace, checkpoints: [...pace.checkpoints.slice(0, -1), cp], updatedAt: cp.at };
  return push(pace, cp);
}

/** Takes back the last "+1". @param {Pace} pace @param {number} at @returns {Pace} */
export function minusOne(pace, at) {
  const last = pace.checkpoints[pace.checkpoints.length - 1];
  const prev = pace.checkpoints[pace.checkpoints.length - 2];
  if (!last || !last.plus || !prev || last.left >= MAX_LEFT) return pace;
  // Back to the count it started from: the rolling checkpoint has nothing left to say.
  if (last.left + 1 >= prev.left) return { ...pace, checkpoints: pace.checkpoints.slice(0, -1), updatedAt: at };
  return { ...pace, checkpoints: [...pace.checkpoints.slice(0, -1), { ...last, left: last.left + 1 }], updatedAt: at };
}

/** Removes the last count (a typing mistake). @param {Pace} pace @param {number} at @returns {Pace} */
export function undoLast(pace, at) {
  if (pace.checkpoints.length === 0) return pace;
  return { ...pace, checkpoints: pace.checkpoints.slice(0, -1), updatedAt: at };
}

/**
 * Break time inside [from, to]. A break still running counts up to `now`.
 * @param {Break[]} breaks @param {number} from @param {number} to @param {number} now
 */
export function breakMsIn(breaks, from, to, now) {
  let ms = 0;
  for (const b of breaks ?? []) {
    const end = b.endAt ?? Math.max(b.startAt, now);
    ms += Math.max(0, Math.min(end, to) - Math.max(b.startAt, from));
  }
  return ms;
}

/** Minutes to the nearest 5 (the margin is never shown to the minute). */
export function round5(min) {
  const r = Math.round(min / 5) * 5;
  return r === 0 ? 0 : r;
}

/** A time to the nearest 5 minutes ("verso le 17:40"). */
export function roundTime5(ts) {
  return Math.round(ts / (5 * MIN)) * 5 * MIN;
}

/**
 * End of the courier's own day: start + weekly hours / days per week, plus the break when it is unpaid.
 * @returns {number|null} null without a contract
 */
export function ownDayEnd({ shiftStartAt, weeklyHours, daysPerWeek, breakPaid, breakMin }) {
  if (!(weeklyHours > 0) || !(daysPerWeek > 0)) return null;
  return shiftStartAt + (weeklyHours / daysPerWeek) * 60 * MIN + (breakPaid ? 0 : breakMin * MIN);
}

/**
 * @typedef {{state:'empty'|'collecting'|'ready', left:number|null, lastAt:number|null, count:number,
 *   stops:number, workedMin:number, needStops:number, needMin:number,
 *   mps:number|null,             // worked minutes per delivery
 *   finishAt:number|null,        // back at the depot, to the nearest 5 minutes
 *   dayEndAt:number|null, marginMin:number|null,   // margin to the nearest 5 min; negative = past the own day
 *   breakLeftMin:number, askAgain:boolean}} Projection
 */

/**
 * `mps = worked minutes / deliveries done` on the last two counts when there are three or more (and
 * they are far enough apart to mean something), else on base and last. Ready with at least 5
 * deliveries and 20 worked minutes. `back = tn + rn × mps + break still to take + road to the depot`.
 * @param {{checkpoints:Checkpoint[], breaks:Break[], shiftStartAt:number, now:number, breakMin:number,
 *   breakPaid:boolean, weeklyHours:number|null, daysPerWeek:number|null, returnMin:number}} p
 * @returns {Projection}
 */
export function paceProject(p) {
  const now = p.now;
  const breakTakenMin = breakMsIn(p.breaks, p.shiftStartAt, now, now) / MIN;
  const breakLeftMin = Math.max(0, Math.round(p.breakMin - breakTakenMin));
  const dayEndAt = ownDayEnd(p);
  /** @type {Projection} */
  const out = { state: 'empty', left: null, lastAt: null, count: 0, stops: 0, workedMin: 0, needStops: MIN_STOPS,
    needMin: MIN_WORKED_MIN, mps: null, finishAt: null, dayEndAt, marginMin: null, breakLeftMin, askAgain: false };
  const all = (p.checkpoints ?? []).filter((c) => c && isTs(c.at) && isLeft(c.left)).sort((a, b) => a.at - b.at);
  if (all.length === 0) return out;

  // A count that goes up is a new load: the pace starts again from there.
  let from = 0;
  for (let i = 1; i < all.length; i++) if (all[i].left > all[i - 1].left) from = i;
  const run = all.slice(from);
  const base = run[0];
  const last = run[run.length - 1];
  const span = (a, b) => {
    const stops = a.left - b.left;
    const workedMin = Math.max(0, b.at - a.at - breakMsIn(p.breaks, a.at, b.at, now)) / MIN;
    return { stops, workedMin, ok: stops >= MIN_STOPS && workedMin >= MIN_WORKED_MIN };
  };
  const whole = span(base, last);
  const recent = run.length >= 3 ? span(run[run.length - 2], last) : null;
  const used = recent && recent.ok ? recent : whole;

  out.left = last.left;
  out.lastAt = last.at;
  out.count = run.length;
  out.stops = whole.stops;
  out.workedMin = whole.workedMin;
  out.needStops = Math.max(0, MIN_STOPS - whole.stops);
  out.needMin = Math.max(0, Math.ceil(MIN_WORKED_MIN - whole.workedMin));
  out.askAgain = last.left > 0 && now - last.at >= ASK_AGAIN_MIN * MIN;

  if (last.left > 0 && !used.ok) {
    out.state = 'collecting';
    return out;
  }
  const mps = last.left > 0 ? used.workedMin / used.stops : 0;
  // Break time already taken after the last count pushes the work later, like the break still to take.
  const raw = last.at + last.left * mps * MIN + breakMsIn(p.breaks, last.at, now, now) + breakLeftMin * MIN
    + p.returnMin * MIN;
  const finish = Math.max(raw, now);
  out.state = 'ready';
  out.mps = last.left > 0 ? mps : null;
  out.finishAt = roundTime5(finish);
  out.marginMin = dayEndAt === null ? null : round5((dayEndAt - finish) / MIN);
  return out;
}
