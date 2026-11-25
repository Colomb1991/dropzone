// @ts-check
// Checklist del furgone (SPEC 11): a short list the courier edits (at most 10 lines), ticked at the
// start of a diary session and stored with that session. Pure.
import { cleanText } from '../../../core/pure/validators.js';

export const MAX_ITEMS = 10;
export const MAX_LABEL = 40;
/** The list every courier starts with; the words come from the dictionaries (`furgone.check.item.*`). */
export const DEFAULT_ITEMS = /** @type {const} */ (['luci', 'gomme', 'specchietti', 'carrozzeria', 'carburante']);

/** @typedef {{label:string, ok:boolean}} Check */

const same = (a, b) => a.toLocaleLowerCase() === b.toLocaleLowerCase();
const isLabel = (v) => typeof v === 'string' && v !== '' && v.length <= MAX_LABEL && cleanText(v) === v;

/** Setting `furgone.checklist`: null (the default list) or the courier's own lines. */
export function validChecklist(v) {
  if (v === null) return true;
  if (!Array.isArray(v) || v.length > MAX_ITEMS) return false;
  return v.every((x, i) => isLabel(x) && !v.slice(0, i).some((y) => same(x, y)));
}

/** Lines as typed → a valid list: cleaned, cut to 40 characters, no repeats, at most 10. @returns {string[]} */
export function cleanItems(list) {
  /** @type {string[]} */
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const label = cleanText(raw).slice(0, MAX_LABEL).trim();
    if (label !== '' && !out.some((y) => same(label, y)) && out.length < MAX_ITEMS) out.push(label);
  }
  return out;
}

/**
 * @param {string[]} items @param {string} text
 * @returns {{ok:true, items:string[]} | {ok:false, reason:'empty'|'full'|'repeat'}}
 */
export function addItem(items, text) {
  const label = cleanText(text).slice(0, MAX_LABEL).trim();
  if (label === '') return { ok: false, reason: 'empty' };
  if (items.length >= MAX_ITEMS) return { ok: false, reason: 'full' };
  if (items.some((y) => same(label, y))) return { ok: false, reason: 'repeat' };
  return { ok: true, items: [...items, label] };
}

/** @param {string[]} items @param {number} index @returns {string[]} */
export function removeItem(items, index) {
  return items.filter((x, i) => i !== index);
}

/** `checks` of a `van` record: [] when missing (records older than the checklist), null when broken. */
export function validateChecks(raw) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_ITEMS) return null;
  /** @type {Check[]} */
  const out = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object' || typeof c.label !== 'string' || c.label === '' || c.label.length > MAX_LABEL) return null;
    out.push({ label: c.label, ok: c.ok === true });
  }
  return out;
}

/**
 * The rows to show for the session of now: the list as it is today, each line with the tick stored
 * for it; a line ticked earlier and since removed from the list stays, because it was checked.
 * @param {string[]} items @param {Check[]} stored @returns {Check[]}
 */
export function checkRows(items, stored) {
  const rows = items.map((label) => ({ label, ok: stored.some((c) => c.ok && same(c.label, label)) }));
  const kept = stored.filter((c) => c.ok && !items.some((label) => same(label, c.label)));
  return [...rows, ...kept.map((c) => ({ label: c.label, ok: true }))].slice(0, MAX_ITEMS);
}

/** Flips one line. @param {Check[]} rows @param {number} index @returns {Check[]} */
export function toggleCheck(rows, index) {
  return rows.map((c, i) => (i === index ? { label: c.label, ok: !c.ok } : c));
}

/** @param {Check[]} checks @returns {{ok:number, total:number}} */
export function checksSummary(checks) {
  return { ok: checks.filter((c) => c.ok).length, total: checks.length };
}
