// @ts-check
// Where the counts of the running shift live: one record in the `kv` store (never in a backup,
// cleared by "Elimina tutto"), removed when the shift ends. No new store, so nothing to migrate.
import { db, clock, session, settings, log } from '../../../core/api.js';
import * as P from './pace.js';

export const PACE_KEY = 'ritmo.pace';

/** The counts of the running shift; empty when there is no shift or the record is of another one. */
export async function loadPace() {
  const shift = session.active();
  if (!shift) return null;
  const pace = P.validatePace(await db.get('kv', PACE_KEY));
  return pace && pace.shiftId === shift.id ? pace : P.emptyPace(shift.id);
}

/**
 * Read-modify-write in one transaction. `change` returns the same object to refuse.
 * @param {(pace:P.Pace, now:number) => P.Pace} change @returns {Promise<{pace:P.Pace|null, changed:boolean}>}
 */
function mutate(change) {
  const shift = session.active();
  if (!shift) return Promise.resolve({ pace: null, changed: false });
  return db.tx(['kv'], 'rw', async (t) => {
    const stored = P.validatePace(await t.get('kv', PACE_KEY));
    const pace = stored && stored.shiftId === shift.id ? stored : P.emptyPace(shift.id);
    const next = change(pace, clock.now());
    if (next === pace) return { pace, changed: false };
    await t.put('kv', { key: PACE_KEY, ...next });
    return { pace: next, changed: true };
  });
}

/** A count typed by the courier ("quante te ne mancano?"). The first one is the base. */
export const saveCount = (left) => mutate((pace, now) => P.addCheckpoint(pace, left, now));
export const plusOne = () => mutate((pace, now) => P.plusOne(pace, now));
export const minusOne = () => mutate((pace, now) => P.minusOne(pace, now));
export const undoLast = () => mutate((pace, now) => P.undoLast(pace, now));

/** The counts belong to one shift: they go when it ends. */
export function clearPace() {
  return db.del('kv', PACE_KEY).catch((err) => log.error('ritmo', err));
}

/** Everything paceProject needs, read from the shift and the settings. */
export function projectionInput(shift, pace, now) {
  return {
    checkpoints: pace ? pace.checkpoints : [], breaks: shift.breaks, shiftStartAt: shift.startAt, now,
    breakMin: settings.get('shift.breakMin'), breakPaid: settings.get('contract.breakPaid') === true,
    weeklyHours: settings.get('contract.weeklyHours'), daysPerWeek: settings.get('contract.daysPerWeek'),
    returnMin: settings.get('ritmo.returnMin'),
  };
}
