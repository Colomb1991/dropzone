// @ts-check
// Month calendar of "Ore e riepilogo": which days have a recorded shift, and the shift written by
// "Giornata intera". Pure: stored timestamps in, a grid out. Local time zone of the device.
import { dayKey, shiftTotals, atTime } from './hours.js';

/** A full day when no contract is set: 8 hours. */
export const DEFAULT_DAY_MIN = 480;
/** "Giornata intera" starts here, like the form of "Aggiungi turno". */
export const FULL_DAY_START = '08:00';

/** @typedef {import('./hours.js').ShiftLike & {manual?:boolean}} DayShift */
/** @typedef {{day:number, key:string, ts:number, shifts:DayShift[], workedMs:number, worked:boolean,
 *   manual:boolean, today:boolean, future:boolean}} CalDay
 *   `ts`: local midnight; `manual`: every shift of the day was added by hand */

/** Days in a month; `month` is 1–12. */
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * The month as weeks from Monday to Sunday. A shift belongs to the local day it starts on, also
 * when it ends after midnight; shifts that start outside the month are not counted.
 * @param {DayShift[]} shifts @param {number} year @param {number} month 1–12
 * @param {{now:number, breakPaid:boolean}} opts
 * @returns {{year:number, month:number, lead:number, days:CalDay[], weeks:(CalDay|null)[][],
 *   workedDays:number, workedMs:number}} `lead`: empty cells before day 1 (0 = the month starts on a Monday)
 */
export function monthCalendar(shifts, year, month, opts) {
  /** @type {Map<string, DayShift[]>} */
  const byDay = new Map();
  for (const s of shifts ?? []) {
    const key = dayKey(s.startAt);
    if (!byDay.has(key)) byDay.set(key, []);
    /** @type {DayShift[]} */ (byDay.get(key)).push(s);
  }
  const todayKey = dayKey(opts.now);
  /** @type {CalDay[]} */
  const days = [];
  let workedDays = 0;
  let workedMs = 0;
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    const ts = new Date(year, month - 1, d).getTime();
    const key = dayKey(ts);
    const list = [...(byDay.get(key) ?? [])].sort((a, b) => a.startAt - b.startAt);
    const ms = list.reduce((sum, s) => sum + shiftTotals(s, opts.breakPaid, opts.now).workedMs, 0);
    if (list.length > 0) workedDays++;
    workedMs += ms;
    days.push({ day: d, key, ts, shifts: list, workedMs: ms, worked: list.length > 0,
      manual: list.length > 0 && list.every((s) => s.manual === true), today: key === todayKey, future: ts > opts.now });
  }
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  /** @type {(CalDay|null)[]} */
  const cells = [...Array.from({ length: lead }, () => null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, month, lead, days, weeks, workedDays, workedMs };
}

/**
 * Minutes of a full day by the contract: the weekly hours over the days a week (5 when the days
 * are not set). 8 hours when no contract is set.
 * @param {{weeklyHours:number|null|undefined, daysPerWeek:number|null|undefined}} contract
 */
export function fullDayMinutes({ weeklyHours, daysPerWeek }) {
  if (!(Number(weeklyHours) > 0)) return DEFAULT_DAY_MIN;
  const days = Number(daysPerWeek) > 0 ? Number(daysPerWeek) : 5;
  return Math.max(1, Math.round((Number(weeklyHours) * 60) / days));
}

/**
 * "Giornata intera" on an empty day: one shift of `minutes`, from 08:00, with no break (so the
 * hours worked are the contract's, whatever the break rule). No shift ends in the future: today
 * it ends now at the latest and starts earlier instead. Null when the day is still to come or
 * when today is not that old yet.
 * @param {{dayTs:number, minutes:number, now:number}} v `dayTs`: any moment of the day
 * @returns {{startAt:number, endAt:number, breaks:[]}|null}
 */
export function fullDayShift({ dayTs, minutes, now }) {
  const len = Math.round(minutes) * 60000;
  if (!(len > 0)) return null;
  const midnight = atTime(dayTs, '00:00');
  let startAt = atTime(dayTs, FULL_DAY_START);
  let endAt = startAt + len;
  if (endAt > now) {
    endAt = Math.floor(now / 60000) * 60000;
    startAt = endAt - len;
  }
  if (startAt < midnight) return null;
  return { startAt, endAt, breaks: [] };
}
