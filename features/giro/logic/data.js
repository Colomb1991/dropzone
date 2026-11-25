// @ts-check
// Storage and services of the route planner: the only file of the feature that writes to the
// database or asks the network gateway. Everything it decides comes from the pure modules.
import { db, clock, geo, gateway, settings, log } from '../../../core/api.js';
import * as R from './route.js';
import {
  canLearnDoor, learnDoor, validateDoorPoint, legSample, addLegSample, removeLegSample, validateLegTime,
} from './learn.js';
import { photonSuggestions } from './address.js';

const STORES = ['route', 'doorPoints', 'legTimes'];
/** A fix this recent is "where the courier is now". */
const FRESH_FIX_MS = 20000;

const newId = () => crypto.randomUUID();

/** @returns {import('../../../core/types.js').Fix|null} the last fix, when it is fresh */
export function recentFix(maxAgeMs = FRESH_FIX_MS) {
  const fix = geo.lastFix();
  return fix && clock.now() - fix.ts <= maxAgeMs ? fix : null;
}

/** The position for an explicit action ("Aggiungi qui", "Ordina il giro"): fresh, or one new reading. */
export async function positionNow() {
  return recentFix() ?? geo.currentPosition({ maxAgeMs: 10000 });
}

const live = (rec, now) => {
  const route = R.validateRoute(rec);
  return route && !R.isExpired(route, now) ? route : null;
};

/** The route of today; an expired one is deleted and reads as empty. @returns {Promise<R.Route>} */
export async function loadRoute() {
  const now = clock.now();
  const rec = await db.get('route', R.ROUTE_ID);
  const route = live(rec, now);
  if (rec && !route) await db.del('route', R.ROUTE_ID);
  return route ?? R.emptyRoute(now);
}

/** Boot: a route older than 24 hours leaves the phone even if nobody opens the planner. */
export function purgeExpired() {
  return loadRoute().then(() => undefined, (err) => log.error('giro', err));
}

/**
 * Read-modify-write of the route in one transaction.
 * @template {{route:R.Route}} T
 * @param {(route:R.Route, now:number) => T} change @returns {Promise<T>}
 */
function mutate(change) {
  return db.tx(['route'], 'rw', async (t) => {
    const now = clock.now();
    const route = live(await t.get('route', R.ROUTE_ID), now) ?? R.emptyRoute(now);
    const res = change(route, now);
    if (res.route !== route) await t.put('route', res.route);
    return res;
  });
}

/**
 * @param {{lat:number, lon:number, label:string, src:R.StopSource, addr?:string|null}[]} inputs
 * @returns {Promise<{route:R.Route, added:number, repeated:number, full:number}>}
 */
export function addStops(inputs) {
  const stops = /** @type {R.Stop[]} */ (inputs.map((i) => R.makeStop(i, newId())).filter(Boolean));
  return mutate((route, now) => R.addStops(route, stops, now));
}

export const removeStop = (id) => mutate((route, now) => ({ route: R.removeStop(route, id, now) }));
export const moveStop = (id, dir) => mutate((route, now) => ({ route: R.moveStop(route, id, dir, now) }));
export const makeNext = (id) => mutate((route, now) => ({ route: R.makeNext(route, id, now) }));

/** Puts a removed stop back where it was ("Annulla" of the toast). @param {R.Stop} stop @param {number} index */
export function restoreStop(stop, index) {
  return mutate((route, now) => {
    if (route.stops.some((s) => s.id === stop.id) || route.stops.length >= R.MAX_STOPS) return { route };
    const stops = [...route.stops];
    const firstPending = stops.findIndex((s) => !s.done);
    const at = Math.max(firstPending < 0 ? stops.length : firstPending, Math.min(index, stops.length));
    stops.splice(at, 0, { ...stop, done: false });
    return { route: { ...route, stops, updatedAt: now } };
  });
}

/**
 * "Ordina il giro" from `start` (null: the first stop stays first).
 * @returns {Promise<{route:R.Route, beforeM:number, afterM:number}>}
 */
export function sortRoute(start) {
  return mutate((route, now) => {
    const sorted = R.sortPending(route, start, now);
    const beforeM = R.pendingLengthM(route, start);
    const afterM = R.pendingLengthM(sorted, start);
    // Never hand back a longer round than the one the courier already had.
    return afterM < beforeM - 1 ? { route: sorted, beforeM, afterM } : { route, beforeM, afterM: beforeM };
  });
}

/** "Svuota giro": the stops go, what the app has learned stays. */
export function clearRoute() {
  return db.del('route', R.ROUTE_ID);
}

async function learnInTx(t, stop, fix, now) {
  const prev = validateDoorPoint(await t.get('doorPoints', stop.addr));
  await t.put('doorPoints', learnDoor(prev, { key: stop.addr, label: stop.label }, fix, now));
  return { key: stop.addr, prev };
}

/**
 * The fix was not fresh at "Fatto": one reading, then the door point if the stop is still done.
 * Outside a shift this asks the phone only where the courier already allowed the position.
 */
function learnLater(stop) {
  if (!geo.isRunning() && settings.get('locationExplained') !== true) return;
  geo.currentPosition({ maxAgeMs: 10000, timeoutMs: 6000 }).then((fix) => {
    if (!canLearnDoor(stop, fix)) return undefined;
    return db.tx(['route', 'doorPoints'], 'rw', async (t) => {
      const now = clock.now();
      const route = live(await t.get('route', R.ROUTE_ID), now);
      if (!route?.stops.some((s) => s.id === stop.id && s.done)) return;
      const door = await learnInTx(t, stop, fix, now);
      if (route.undo?.stopId === stop.id && !route.undo.door) {
        await t.put('route', { ...route, undo: { ...route.undo, door } });
      }
    });
  }).catch((err) => log.error('giro', err));
}

/**
 * "Fatto": marks the stop, records the leg that just ended (duration only, by cells and hour band)
 * and, with a good fix at the door, learns the door point of an address stop.
 * @param {string} id
 * @returns {Promise<{route:R.Route, stop:R.Stop, learned:boolean}|null>} null when the stop is not pending
 */
export async function completeStop(id) {
  const fix = recentFix();
  const res = await db.tx(STORES, 'rw', async (t) => {
    const now = clock.now();
    const cur = live(await t.get('route', R.ROUTE_ID), now);
    const done = cur ? R.completeStop(cur, id, now) : null;
    if (!done) return null;
    const undo = /** @type {R.Undo} */ ({ ...done.route.undo });
    const sample = done.leg ? legSample(done.leg.from, done.leg.to, done.leg.startAt, done.leg.endAt) : null;
    if (sample) {
      const prev = validateLegTime(await t.get('legTimes', sample.id));
      await t.put('legTimes', addLegSample(prev, sample, now));
      undo.leg = { id: sample.id, sec: sample.sec };
    }
    const learned = canLearnDoor(done.stop, fix);
    if (learned) undo.door = await learnInTx(t, done.stop, fix, now);
    const route = { ...done.route, undo };
    await t.put('route', route);
    return { route, stop: done.stop, learned };
  });
  if (res && !res.learned && res.stop.addr && !fix) learnLater(res.stop);
  return res;
}

/** "Annulla": takes back the last "Fatto" with everything it taught. @returns {Promise<R.Route|null>} */
export function undoComplete() {
  return db.tx(STORES, 'rw', async (t) => {
    const now = clock.now();
    const cur = live(await t.get('route', R.ROUTE_ID), now);
    const res = cur ? R.undoComplete(cur, now) : null;
    if (!res) return null;
    if (res.undo.leg) {
      const rec = removeLegSample(validateLegTime(await t.get('legTimes', res.undo.leg.id)), res.undo.leg.sec, now);
      if (rec) await t.put('legTimes', rec);
      else await t.del('legTimes', res.undo.leg.id);
    }
    if (res.undo.door) {
      const prev = validateDoorPoint(res.undo.door.prev);
      if (prev) await t.put('doorPoints', prev);
      else await t.del('doorPoints', res.undo.door.key);
    }
    await t.put('route', res.route);
    return res.route;
  });
}

/** Every learned door point. @returns {Promise<import('./address.js').DoorPoint[]>} */
export async function listDoorPoints() {
  const all = await db.getAll('doorPoints');
  return /** @type {any[]} */ (all.map(validateDoorPoint).filter(Boolean));
}

/** May the online search run now? @returns {{allowed:boolean, reason:string}} */
export function onlineSearchState() {
  return gateway.serviceState('photon');
}

/**
 * One online lookup. The gateway rounds the bias to about 10 km and paces the requests.
 * @param {string} text @param {{signal?:AbortSignal}} [opts]
 * @returns {Promise<import('./address.js').Suggestion[]>} rejects with NetError
 */
export async function searchOnline(text, opts) {
  const fix = geo.lastFix();
  const res = await gateway.photonSearch(text, fix ? { lat: fix.lat, lon: fix.lon } : null, opts);
  return photonSuggestions(res.features);
}
