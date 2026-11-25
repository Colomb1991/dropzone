// @ts-check
import * as db from '../db/db.js';
import { AppError } from '../errors.js';
import { validateShift } from '../pure/validators.js';
import { repairPlan } from '../pure/shift-repair.js';

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

/**
 * Start of a shift: the record and the pointer to it in ONE transaction, so the app can die at any
 * moment and leave either both or neither (never an open shift nobody points at).
 * @param {Shift} s @returns {Promise<Shift>}
 */
export function openShift(s) {
  const rec = checked(s);
  return db.tx(['shifts', 'kv'], 'rw', async (t) => {
    await t.put('shifts', rec);
    await t.put('kv', { key: ACTIVE_KEY, value: rec.id });
    return rec;
  });
}

/**
 * End of a shift: the closed record and the cleared pointer in one transaction. A shift that is
 * already closed is returned as it is (a second tap changes nothing).
 * @param {string} id @param {(s: Shift) => Shift} fn @returns {Promise<Shift>}
 */
export function closeShift(id, fn) {
  return db.tx(['shifts', 'kv'], 'rw', async (t) => {
    const cur = await t.get('shifts', id);
    if (!cur) throw new AppError('shift-missing', 'core.err.generic');
    const next = cur.endAt === null ? checked(fn(cur)) : cur;
    if (next !== cur) await t.put('shifts', next);
    if ((await t.get('kv', ACTIVE_KEY))?.value === id) await t.del('kv', ACTIVE_KEY);
    return next;
  });
}

/**
 * Boot: reads the pointer and the shifts and repairs what does not fit (pure rules: repairPlan).
 * One transaction. @returns {Promise<{active:Shift|null, closed:number, removed:number}>}
 */
export function recoverOpen() {
  return db.tx(['shifts', 'kv'], 'rw', async (t) => {
    const stored = (await t.get('kv', ACTIVE_KEY))?.value ?? null;
    const plan = repairPlan(await t.getAll('shifts'), typeof stored === 'string' ? stored : null);
    for (const s of plan.close) await t.put('shifts', s);
    for (const id of plan.remove) await t.del('shifts', id);
    if (stored !== null && plan.activeId === null) await t.del('kv', ACTIVE_KEY);
    return { active: plan.active, closed: plan.close.length, removed: plan.remove.length };
  });
}
