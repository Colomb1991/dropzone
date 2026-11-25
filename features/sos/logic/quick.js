// @ts-check
// Numeri rapidi and the accident card (SPEC 11). Pure.
import { cleanText } from '../../../core/pure/validators.js';

export const MAX_QUICK = 5;
export const NAME_MAX = 20;
/** Steps of "Incidente col furgone", in order, with the icon of each row. */
export const INCIDENT_STEPS = /** @type {const} */ ([
  { id: 1, icon: 'triangle-alert' }, { id: 2, icon: 'phone' }, { id: 3, icon: 'camera' },
  { id: 4, icon: 'car' }, { id: 5, icon: 'user' },
]);

/** @typedef {{name:string, number:string}} QuickNumber  `number`: as it is dialled, see cleanDial */

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * A number as it is dialled: 3 to 15 digits with an optional leading "+". Unlike the SOS contact it
 * is not forced into international form: short and internal numbers must stay what the courier typed.
 * @param {unknown} input @returns {string|null} null when it is not a phone number
 */
export function cleanDial(input) {
  if (typeof input !== 'string') return null;
  let s = input.replace(/[\s\-()./]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  return /^\+?\d{3,15}$/.test(s) ? s : null;
}

/** Validator of the setting `sos.quick`. @returns {boolean} */
export function validateQuick(v) {
  return Array.isArray(v) && v.length <= MAX_QUICK && v.every((q) => isObj(q)
    && typeof q.name === 'string' && q.name !== '' && q.name.length <= NAME_MAX && cleanText(q.name) === q.name
    && typeof q.number === 'string' && cleanDial(q.number) === q.number);
}

/** What is wrong with one row of the form: nothing, or the field to fix. Empty rows are fine. */
export function rowProblem(row) {
  const name = cleanText(row?.name);
  const raw = String(row?.number ?? '').trim();
  if (name === '' && raw === '') return null;
  if (cleanDial(raw) === null) return 'number';
  return name === '' ? 'name' : null;
}

/**
 * The rows of the form → the value to store. Rows left empty are dropped.
 * @param {{name:string, number:string}[]} rows @returns {QuickNumber[]|null} null while a row is wrong
 */
export function quickFromForm(rows) {
  /** @type {QuickNumber[]} */
  const out = [];
  for (const row of rows ?? []) {
    if (rowProblem(row)) return null;
    const name = cleanText(row?.name).slice(0, NAME_MAX).trim();
    const number = cleanDial(String(row?.number ?? '').trim());
    if (name !== '' && number !== null) out.push({ name, number });
  }
  return out.length <= MAX_QUICK ? out : null;
}

/** Ticks or unticks one step of the checklist. @param {number[]} done @param {number} id */
export function toggleStep(done, id) {
  return done.includes(id) ? done.filter((n) => n !== id) : [...done, id].sort((a, b) => a - b);
}
