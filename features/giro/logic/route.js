// @ts-check
// The route of today: one record. `stops` is the visiting order: done stops first, in the order they
// were done, then the pending ones. Stops are addresses or points with a short label, nothing else:
// no parcel, no customer name. Pure functions; ids and the clock come from the caller.
import { distM, round } from '../../../core/pure/geo-math.js';
import { isLat, isLon } from '../../../core/pure/validators.js';
import { cleanLabel } from './address.js';
import { orderStops, pathLengthM } from './order.js';

export const ROUTE_ID = 'current';
/** The route deletes itself this long after its last change (SPEC 11); it is never in the backup. */
export const ROUTE_TTL_MS = 24 * 3600000;
export const MAX_STOPS = 150;
/** "Cosa so di qui" for a stop: notes this close to it. */
export const NOTE_RADIUS_M = 60;
const SAME_PLACE_M = 15;
const SOURCES = ['address', 'door', 'coords', 'here', 'note'];

/** @typedef {'address'|'door'|'coords'|'here'|'note'} StopSource */
/** @typedef {{id:string, lat:number, lon:number, label:string, src:StopSource, addr:string|null,
 *   done:boolean}} Stop  `addr`: normalised address when the stop came from one, else null */
/** @typedef {{stopId:string, at:number}} LastDone  the only time the route keeps: the last "Fatto" */
/** @typedef {{stopId:string, leg:{id:string, sec:number}|null,
 *   door:{key:string, prev:object|null}|null}} Undo  what the last "Fatto" taught, to take it back */
/** @typedef {{id:'current', stops:Stop[], last:LastDone|null, undo:Undo|null, updatedAt:number}} Route */

/** @param {number} now @returns {Route} */
export function emptyRoute(now) {
  return { id: ROUTE_ID, stops: [], last: null, undo: null, updatedAt: now };
}

/** @param {Route|null|undefined} route @param {number} now */
export function isExpired(route, now) {
  return Boolean(route) && now - /** @type {Route} */ (route).updatedAt > ROUTE_TTL_MS;
}

/** @param {Route} route */
export const pendingStops = (route) => route.stops.filter((s) => !s.done);
/** @param {Route} route */
export const doneStops = (route) => route.stops.filter((s) => s.done);
/** @param {Route} route @returns {Stop|null} */
export const nextStop = (route) => route.stops.find((s) => !s.done) ?? null;
/** "12 di 40". @param {Route} route */
export const progress = (route) => ({ done: doneStops(route).length, total: route.stops.length });

/**
 * @param {{lat:number, lon:number, label:string, src:StopSource, addr?:string|null}} input
 * @param {string} id @returns {Stop|null} null when the point is not valid
 */
export function makeStop(input, id) {
  if (!input || !isLat(input.lat) || !isLon(input.lon) || !SOURCES.includes(input.src)) return null;
  const addr = typeof input.addr === 'string' && input.addr ? input.addr.slice(0, 120) : null;
  return { id, lat: round(input.lat, 6), lon: round(input.lon, 6), label: cleanLabel(input.label), src: input.src,
    addr, done: false };
}

const samePlace = (a, b) => (a.addr || b.addr
  ? a.addr === b.addr
  : distM(a.lat, a.lon, b.lat, b.lon) <= SAME_PLACE_M);

const touch = (route, stops, now, more = {}) => ({ ...route, ...more, stops, updatedAt: now });

/**
 * Appends stops. A stop that is already waiting in the route (same address, or the same point for
 * stops without an address) is skipped; the route holds 150 stops at most.
 * @param {Route} route @param {Stop[]} stops @param {number} now
 * @returns {{route:Route, added:number, repeated:number, full:number}}
 */
export function addStops(route, stops, now) {
  const out = [...route.stops];
  let added = 0;
  let repeated = 0;
  let full = 0;
  for (const s of stops) {
    if (out.some((x) => !x.done && samePlace(x, s))) repeated++;
    else if (out.length >= MAX_STOPS) full++;
    else {
      out.push({ ...s, done: false });
      added++;
    }
  }
  return { route: added ? touch(route, out, now) : route, added, repeated, full };
}

/** Removes a pending stop. @param {Route} route @param {string} id @param {number} now @returns {Route} */
export function removeStop(route, id, now) {
  const stops = route.stops.filter((s) => s.id !== id || s.done);
  return stops.length === route.stops.length ? route : touch(route, stops, now);
}

/**
 * Moves a pending stop one place up (-1) or down (+1) among the pending ones.
 * @param {Route} route @param {string} id @param {-1|1} dir @param {number} now @returns {Route}
 */
export function moveStop(route, id, dir, now) {
  const i = route.stops.findIndex((s) => s.id === id && !s.done);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= route.stops.length || route.stops[j].done) return route;
  const stops = [...route.stops];
  [stops[i], stops[j]] = [stops[j], stops[i]];
  return touch(route, stops, now);
}

/** "Fai adesso": the stop becomes the next one. @param {Route} route @param {string} id @param {number} now */
export function makeNext(route, id, now) {
  const stop = route.stops.find((s) => s.id === id && !s.done);
  const first = nextStop(route);
  if (!stop || !first || first.id === id) return route;
  const rest = route.stops.filter((s) => s.id !== id);
  rest.splice(rest.findIndex((s) => !s.done), 0, stop);
  return touch(route, rest, now);
}

/**
 * "Ordina il giro": the pending stops in the order of nearest neighbour + 2-opt, from `start`.
 * @param {Route} route @param {{lat:number, lon:number}|null} start @param {number} now @returns {Route}
 */
export function sortPending(route, start, now) {
  const pending = pendingStops(route);
  if (pending.length < 2) return route;
  return touch(route, [...doneStops(route), ...orderStops(start, pending)], now);
}

/** Straight-line length of what is left, from `start`. @param {Route} route */
export function pendingLengthM(route, start) {
  return pathLengthM(start, pendingStops(route));
}

/**
 * "Fatto". The stop joins the done ones; `leg` describes the stretch that just ended, when the stop
 * before it was done in this same route.
 * @param {Route} route @param {string} id @param {number} now
 * @returns {{route:Route, stop:Stop, leg:{from:Stop, to:Stop, startAt:number, endAt:number}|null}|null}
 */
export function completeStop(route, id, now) {
  const stop = route.stops.find((s) => s.id === id && !s.done);
  if (!stop) return null;
  const from = route.last ? route.stops.find((s) => s.done && s.id === route.last?.stopId) : undefined;
  const done = { ...stop, done: true };
  const stops = [...doneStops(route), done, ...pendingStops(route).filter((s) => s.id !== id)];
  const undo = { stopId: id, leg: null, door: null };
  return {
    route: touch(route, stops, now, { last: { stopId: id, at: now }, undo }),
    stop: done,
    leg: from && route.last ? { from, to: done, startAt: route.last.at, endAt: now } : null,
  };
}

/**
 * "Annulla": the last "Fatto" is taken back and its stop is the next one again. The time of the
 * stop before it is not kept, so the leg that follows an undo is simply not measured.
 * @param {Route} route @param {number} now @returns {{route:Route, undo:Undo, stop:Stop}|null}
 */
export function undoComplete(route, now) {
  const undo = route.undo;
  const stop = undo ? route.stops.find((s) => s.id === undo.stopId && s.done) : undefined;
  if (!undo || !stop) return null;
  const back = { ...stop, done: false };
  const stops = [...doneStops(route).filter((s) => s.id !== stop.id), back, ...pendingStops(route)];
  return { route: touch(route, stops, now, { last: null, undo: null }), undo, stop: back };
}

const validLast = (v) => (v && typeof v.stopId === 'string' && v.at > 0 ? { stopId: v.stopId, at: v.at } : null);

/** `route` store record. @returns {Route|null} */
export function validateRoute(rec) {
  if (rec === null || typeof rec !== 'object' || rec.id !== ROUTE_ID || !Array.isArray(rec.stops)) return null;
  if (!(rec.updatedAt > 0) || rec.stops.length > MAX_STOPS) return null;
  const stops = [];
  for (const s of rec.stops) {
    const stop = typeof s?.id === 'string' && s.id ? makeStop(s, s.id) : null;
    if (!stop) return null;
    stops.push({ ...stop, done: s.done === true });
  }
  const u = rec.undo;
  const undo = u && typeof u.stopId === 'string' ? {
    stopId: u.stopId,
    leg: u.leg && typeof u.leg.id === 'string' && u.leg.sec > 0 ? { id: u.leg.id, sec: u.leg.sec } : null,
    door: u.door && typeof u.door.key === 'string' ? { key: u.door.key, prev: u.door.prev ?? null } : null,
  } : null;
  return { id: ROUTE_ID, stops, last: validLast(rec.last), undo, updatedAt: rec.updatedAt };
}

/**
 * What the courier already knows at a stop: the saved notes within 60 m, nearest first.
 * @template {{id:string, lat:number, lon:number}} N
 * @param {{lat:number, lon:number}} stop @param {N[]} notes @param {number} [radiusM] @param {number} [limit]
 * @returns {N[]}
 */
export function notesNear(stop, notes, radiusM = NOTE_RADIUS_M, limit = 3) {
  return notes.map((note) => ({ note, d: distM(stop.lat, stop.lon, note.lat, note.lon) }))
    .filter((x) => x.d <= radiusM).sort((a, b) => a.d - b.d).slice(0, limit).map((x) => x.note);
}

/**
 * Centre and zoom that show every point in a map of the given size (Web Mercator, 512 px tiles).
 * @param {{lat:number, lon:number}[]} points @param {number} [widthPx] @param {number} [heightPx]
 * @returns {{lat:number, lon:number, zoom:number}|null} null without points
 */
export function viewFor(points, widthPx = 320, heightPx = 260) {
  if (!points || points.length === 0) return null;
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lons);
  const east = Math.max(...lons);
  const lat = (south + north) / 2;
  // Keep the pins off the edges: they are 28 px wide and the next one more.
  const fit = (px, spanDeg) => Math.log2((px * 0.7 * 360) / (512 * Math.max(spanDeg, 1e-6)));
  const zoom = Math.min(fit(widthPx, east - west), fit(heightPx, (north - south) / Math.cos((lat * Math.PI) / 180)));
  return { lat: round(lat, 6), lon: round((west + east) / 2, 6), zoom: Math.max(5, Math.min(16, Math.floor(zoom * 4) / 4)) };
}
