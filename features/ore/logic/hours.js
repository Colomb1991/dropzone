// @ts-check
// Hours and overtime (SPEC 6.4). Pure: stored timestamps in, sums out. Local time zone of the device.

/** @typedef {{startAt:number, endAt:number|null, plannedMin:number}} Break */
/** @typedef {{id:string, startAt:number, endAt:number|null, breaks:Break[], edited:boolean}} ShiftLike */
/** @typedef {{inShiftMs:number, breakMs:number, workedMs:number, open:boolean}} Totals */
/** @typedef {{weeklyHours:number|null, breakPaid:boolean, now:number}} SumOpts */

const HOUR_MS = 3600000;

/** Local "YYYY-MM-DD". */
export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local midnight `n` days after the day of `ts` (DST-safe: built from local date parts). */
export function addDays(ts, n) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}

/** Monday 00:00 local of the week of `ts`. */
export function weekStart(ts) {
  const dow = (new Date(ts).getDay() + 6) % 7;
  return addDays(ts, -dow);
}

/**
 * A running shift counts up to `now`; a break still open counts up to its planned end.
 * @param {ShiftLike} shift @param {boolean} breakPaid @param {number} now @returns {Totals}
 */
export function shiftTotals(shift, breakPaid, now) {
  const open = shift.endAt === null;
  const end = open ? Math.max(now, shift.startAt) : /** @type {number} */ (shift.endAt);
  const inShiftMs = Math.max(0, end - shift.startAt);
  let breakMs = 0;
  for (const b of shift.breaks ?? []) {
    const bEnd = b.endAt ?? Math.min(end, b.startAt + b.plannedMin * 60000);
    breakMs += Math.max(0, bEnd - b.startAt);
  }
  breakMs = Math.min(breakMs, inShiftMs);
  return { inShiftMs, breakMs, workedMs: breakPaid ? inShiftMs : inShiftMs - breakMs, open };
}

function sum(shifts, opts) {
  const acc = { inShiftMs: 0, breakMs: 0, workedMs: 0, days: 0 };
  const days = new Set();
  for (const s of shifts) {
    const t = shiftTotals(s, opts.breakPaid, opts.now);
    acc.inShiftMs += t.inShiftMs;
    acc.breakMs += t.breakMs;
    acc.workedMs += t.workedMs;
    days.add(dayKey(s.startAt));
  }
  acc.days = days.size;
  return acc;
}

const over = (workedMs, weeklyHours) => (weeklyHours == null ? null : Math.max(0, workedMs - weeklyHours * HOUR_MS));

/**
 * Monday to Sunday; a shift belongs to the local date of its start. `overMs` is null without a contract.
 * @param {ShiftLike[]} shifts @param {SumOpts & {weekStartAt:number}} opts
 */
export function weekSummary(shifts, opts) {
  const from = weekStart(opts.weekStartAt);
  const to = addDays(from, 7);
  const mine = shifts.filter((s) => s.startAt >= from && s.startAt < to);
  const s = sum(mine, opts);
  return { startAt: from, endAt: to, ...s, overMs: over(s.workedMs, opts.weeklyHours), count: mine.length };
}

/** Range of shifts a month view needs: whole weeks around the month. `month` is 1–12. */
export function monthRange(year, month) {
  const first = new Date(year, month - 1, 1).getTime();
  const next = new Date(year, month, 1).getTime();
  return { from: weekStart(first), to: addDays(weekStart(next - 1), 7) - 1, first, next };
}

/**
 * Month = sums of its days. "Oltre il contratto" = sum of the weeks that END in the month.
 * @param {ShiftLike[]} shifts shifts of monthRange() @param {number} year @param {number} month 1–12
 * @param {SumOpts} opts
 */
export function monthSummary(shifts, year, month, opts) {
  const { from, to, first, next } = monthRange(year, month);
  const sorted = [...shifts].sort((a, b) => a.startAt - b.startAt);
  const inMonth = sorted.filter((s) => s.startAt >= first && s.startAt < next);
  const total = sum(inMonth, opts);
  const weeks = [];
  let overMs = opts.weeklyHours == null ? null : 0;
  for (let ws = from; ws <= to; ws = addDays(ws, 7)) {
    const w = weekSummary(sorted, { ...opts, weekStartAt: ws });
    const lastDay = addDays(ws, 6);
    const endsInMonth = lastDay >= first && lastDay < next;
    if (endsInMonth && overMs !== null) overMs += w.overMs ?? 0;
    const rows = inMonth.filter((s) => s.startAt >= w.startAt && s.startAt < w.endAt)
      .map((s) => ({ shift: s, totals: shiftTotals(s, opts.breakPaid, opts.now) }));
    if (rows.length > 0) weeks.push({ ...w, lastDay, endsInMonth, rows });
  }
  return { ...total, overMs, weeks, count: inMonth.length };
}

/** Local timestamp of `hhmm` ("07:42") on the local day of `dayTs`. */
export function atTime(dayTs, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(dayTs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0).getTime();
}

/** "0742" for the keypad, from a timestamp. */
export function timeDigits(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
}

/**
 * Edited or added shift: start and end as times of one day (an end before the start is the next
 * day), the break as one block of minutes. Null when the result is not a possible shift.
 * @param {{dayTs:number, start:string, end:string, breakMin:number, now:number}} v
 * @returns {{startAt:number, endAt:number, breaks:Break[]}|null}
 */
export function buildShiftTimes(v) {
  const startAt = atTime(v.dayTs, v.start);
  let endAt = atTime(v.dayTs, v.end);
  if (endAt <= startAt) endAt = atTime(addDays(v.dayTs, 1), v.end);
  const breakMin = Math.round(v.breakMin);
  if (!(breakMin >= 0) || endAt > v.now || endAt - startAt > 24 * HOUR_MS) return null;
  if (breakMin * 60000 >= endAt - startAt) return null;
  const breaks = breakMin > 0 ? [{ startAt, endAt: startAt + breakMin * 60000, plannedMin: breakMin }] : [];
  return { startAt, endAt, breaks };
}
