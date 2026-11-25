// @ts-check
// Storage of the parking point: the only file of the feature that writes to the database.
import { AppError, db, clock, geo, log } from '../../../core/api.js';
import { SPOT_ID, validateSpot, makeSpot, isExpired } from './spot.js';

const STORE = 'vanSpot';
/** A fix this recent is "where the van is now". */
const FRESH_FIX_MS = 10000;

/** The saved point; an expired one is deleted and reads as none. @returns {Promise<import('./spot.js').Spot|null>} */
export async function loadSpot() {
  const spot = validateSpot(await db.get(STORE, SPOT_ID));
  if (spot && isExpired(spot, clock.now())) {
    await db.del(STORE, SPOT_ID);
    return null;
  }
  return spot;
}

/** Boot: a point older than 24 hours leaves the phone even if nobody opens the screen. */
export function purgeExpired() {
  return loadSpot().then(() => undefined, (err) => log.error('furgone-qui', err));
}

/**
 * "Il furgone è qui": the live fix when it is fresh, else one reading.
 * @returns {Promise<import('./spot.js').Spot>} rejects with AppError 'no-position'
 */
export async function saveHere() {
  const last = geo.lastFix();
  const fix = last && clock.now() - last.ts <= FRESH_FIX_MS
    ? last : await geo.currentPosition({ timeoutMs: 10000, maxAgeMs: FRESH_FIX_MS });
  const spot = makeSpot(fix, clock.now());
  if (!spot) throw new AppError('no-position', 'core.err.noPosition');
  await db.put(STORE, spot);
  return spot;
}

/** "L'ho ritrovato". */
export function clearSpot() {
  return db.del(STORE, SPOT_ID);
}

/** "Annulla" after a clear or an overwrite. @param {import('./spot.js').Spot|null} spot */
export function restoreSpot(spot) {
  const rec = validateSpot(spot);
  return rec ? db.put(STORE, rec) : db.del(STORE, SPOT_ID);
}
