// @ts-check
import * as db from '../db/db.js';
import { AppError } from '../errors.js';
import { validateShift } from '../pure/validators.js';

/** @typedef {import('../types.js').Shift} Shift */
const ACTIVE_KEY = 'shift.activeId';

function checked(s) {
  const shift = validateShift(s);
  if (!shift) throw new AppError('shift-invalid', 'core.err.generic');
  return shift;
}

/** Shifts whose start is in [from, to], oldest first. @returns {Promise<Shift[]>} */
export function listShifts(range) {
  return db.getAll('shifts', { index: 'startAt', from: range.from, to: range.to });
}

/** @returns {Promise<Shift|undefined>} */
export function getShift(id) {
  return db.get('shifts', id);
}

/** New or finished shifts only. A running shift is changed with patchShift. */
export async function saveShift(s) {
  await db.put('shifts', checked(s));
}

/**
 * Read-modify-write in one transaction (two windows may hold the same shift).
 * @param {string} id @param {(s: Shift) => Shift} fn @returns {Promise<Shift>}
 */
export function patchShift(id, fn) {
  return db.tx(['shifts'], 'rw', async (t) => {
    const cur = await t.get('shifts', id);
    if (!cur) throw new AppError('shift-missing', 'core.err.generic');
    const next = checked(fn(cur));
    await t.put('shifts', next);
    return next;
  });
}

/** Sets `edited: true`. @param {{startAt?:number, endAt?:number|null, breaks?:object[]}} patch */
export function editShift(id, patch) {
  return patchShift(id, (s) => ({ ...s, ...patch, id: s.id, edited: true }));
}

export async function deleteShift(id) {
  await db.del('shifts', id);
}

/** @returns {Promise<string|null>} */
export async function getActiveId() {
  return (await db.get('kv', ACTIVE_KEY))?.value ?? null;
}

export async function setActiveId(id) {
  if (id === null) await db.del('kv', ACTIVE_KEY);
  else await db.put('kv', { key: ACTIVE_KEY, value: id });
}
