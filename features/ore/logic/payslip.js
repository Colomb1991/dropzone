// @ts-check
// "Confronta con la busta paga" (SPEC 11): the hours the courier reads on the payslip of a month
// next to the hours of the own register. Hours only, never money. Pure.

export const MAX_HOURS = 400;
/** Months kept: three years; the oldest go first. */
export const MAX_MONTHS = 36;
const MAX_MIN = MAX_HOURS * 60;

/** @typedef {{ord:number, extra:number}} PayslipEntry  minutes: ordinary hours and overtime */
/** @typedef {Record<string, PayslipEntry>} PayslipMap  key "YYYY-MM" */

const isMin = (v) => Number.isInteger(v) && v >= 0 && v <= MAX_MIN;
const isKey = (k) => /^\d{4}-(0[1-9]|1[0-2])$/.test(k);
const isEntry = (e) => e !== null && typeof e === 'object' && !Array.isArray(e) && isMin(e.ord) && isMin(e.extra);

/** "2026-11"; month is 1–12. */
export function ymKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Hours as written on a payslip → minutes. "168" · "168,5" and "168.50" (decimal hours: ,5 is half
 * an hour) · "168:30" (hours and minutes). Null when empty, not a number, or over 400 hours.
 * @param {string} text @returns {number|null}
 */
export function parseHours(text) {
  const s = String(text ?? '').trim().replace(/\s+/g, '');
  let min = null;
  let m = /^(\d{1,3}):([0-5]\d)$/.exec(s);
  if (m) min = Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(s);
  if (m) min = Math.round(Number(`${m[1]}.${m[2] ?? '0'}`) * 60);
  return min !== null && isMin(min) ? min : null;
}

/** Minutes → what goes back into the field: "168" or "168:30". */
export function hoursText(min) {
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r === 0 ? String(h) : `${h}:${String(r).padStart(2, '0')}`;
}

/** Setting `ore.payslip`. */
export function validPayslips(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length <= MAX_MONTHS && keys.every((k) => isKey(k) && isEntry(v[k]));
}

/**
 * The map with the entry of one month set, or removed with `null`. Never more than 36 months.
 * @param {PayslipMap} map @param {string} key @param {PayslipEntry|null} entry @returns {PayslipMap}
 */
export function setPayslip(map, key, entry) {
  /** @type {PayslipMap} */
  const out = {};
  for (const k of Object.keys(map ?? {})) if (k !== key && isKey(k) && isEntry(map[k])) out[k] = map[k];
  if (entry && isKey(key) && isEntry(entry)) out[key] = { ord: entry.ord, extra: entry.extra };
  const keys = Object.keys(out).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_MONTHS))) delete out[k];
  return out;
}

/**
 * Register against payslip, in minutes.
 * @param {number} workedMs "Ore lavorate" of the month @param {PayslipEntry} entry
 * @returns {{registerMin:number, payslipMin:number, diffMin:number, more:'register'|'payslip'|'even'}}
 *   `diffMin` is never negative; `more` says which side has the extra time
 */
export function comparePayslip(workedMs, entry) {
  const registerMin = Math.max(0, Math.round(workedMs / 60000));
  const payslipMin = entry.ord + entry.extra;
  const diff = registerMin - payslipMin;
  return { registerMin, payslipMin, diffMin: Math.abs(diff),
    more: diff > 0 ? 'register' : diff < 0 ? 'payslip' : 'even' };
}
