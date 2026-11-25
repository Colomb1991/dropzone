// @ts-check
// CSV of one month (SPEC 6.4): UTF-8 with BOM, ";" separator, decimal comma.
import { shiftTotals, dayKey } from './hours.js';

const HEADER = 'data;inizio;fine;pausa_min;in_turno_h;lavorate_h;modificato';
const EOL = '\r\n';

const hhmm = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const hours = (ms) => (ms / 3600000).toFixed(2).replace('.', ',');

/** "appunti-ore-2026-11.csv"; month is 1–12. */
export function csvFileName(year, month) {
  return `appunti-ore-${year}-${String(month).padStart(2, '0')}.csv`;
}

/**
 * Closed shifts whose start falls in the month, oldest first. The last line says what the file is.
 * @param {import('./hours.js').ShiftLike[]} shifts
 * @param {{year:number, month:number, breakPaid:boolean, footer:string, yes:string, no:string}} opts
 * @returns {string}
 */
export function monthCsv(shifts, opts) {
  const first = new Date(opts.year, opts.month - 1, 1).getTime();
  const next = new Date(opts.year, opts.month, 1).getTime();
  const rows = shifts
    .filter((s) => s.endAt !== null && s.startAt >= first && s.startAt < next)
    .sort((a, b) => a.startAt - b.startAt)
    .map((s) => {
      const t = shiftTotals(s, opts.breakPaid, /** @type {number} */ (s.endAt));
      return [dayKey(s.startAt), hhmm(s.startAt), hhmm(/** @type {number} */ (s.endAt)),
        String(Math.round(t.breakMs / 60000)), hours(t.inShiftMs), hours(t.workedMs),
        s.edited ? opts.yes : opts.no].join(';');
    });
  return `﻿${[HEADER, ...rows, '', opts.footer].join(EOL)}${EOL}`;
}
