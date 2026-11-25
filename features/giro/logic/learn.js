// @ts-check
// What the planner learns (DECISIONS 11): door points and leg times. Pure functions and the
// validators of the two stores.
import { distM, round } from '../../../core/pure/geo-math.js';
import { isLat, isLon } from '../../../core/pure/validators.js';
import { cleanLabel } from './address.js';

/** A door point is learned only from a fix this good, taken this close to the stop. */
export const DOOR_ACC_M = 25;
export const DOOR_RANGE_M = 150;
// New measurements keep counting, but each one moves the point by a fifth at most.
const DOOR_MAX_WEIGHT = 5;

export const LEG_CELL_DEG = 0.05;
export const LEG_BAND_HOURS = 3;
/** Shorter is a double tap, longer is a break: neither is a leg worth learning. */
export const LEG_MIN_MS = 20000;
export const LEG_MAX_MS = 90 * 60000;

/** @typedef {import('./address.js').DoorPoint} DoorPoint */
/** @typedef {{id:string, from:string, to:string, band:number, meanS:number, n:number, updatedAt:number}} LegTime */
/** @typedef {{lat:number, lon:number, acc:number}} FixLike */

/**
 * May this completed stop teach its door? Only a stop that came from an address, and only with the
 * phone's own good fix near it.
 * @param {{lat:number, lon:number, addr?:string|null}} stop @param {FixLike|null|undefined} fix
 */
export function canLearnDoor(stop, fix) {
  if (!stop?.addr || !fix || !isLat(fix.lat) || !isLon(fix.lon)) return false;
  // A fix without an accuracy is not a measurement to keep (null would compare as 0).
  if (typeof fix.acc !== 'number' || !(fix.acc >= 0 && fix.acc <= DOOR_ACC_M)) return false;
  return distM(stop.lat, stop.lon, fix.lat, fix.lon) <= DOOR_RANGE_M;
}

/**
 * The door point after one more measurement. The position always comes from the phone's fix, never
 * from the stop (whose coordinates may be the geocoder's).
 * @param {DoorPoint|null|undefined} prev @param {{key:string, label:string}} addr
 * @param {FixLike} fix @param {number} now @returns {DoorPoint}
 */
export function learnDoor(prev, addr, fix, now) {
  if (!prev) {
    return { key: addr.key, label: cleanLabel(addr.label), lat: round(fix.lat, 6), lon: round(fix.lon, 6), n: 1,
      updatedAt: now };
  }
  const w = 1 / Math.min(prev.n + 1, DOOR_MAX_WEIGHT);
  return {
    key: prev.key, label: prev.label || cleanLabel(addr.label),
    lat: round(prev.lat + (fix.lat - prev.lat) * w, 6), lon: round(prev.lon + (fix.lon - prev.lon) * w, 6),
    n: prev.n + 1, updatedAt: now,
  };
}

/** `doorPoints` store record. @returns {DoorPoint|null} */
export function validateDoorPoint(rec) {
  if (rec === null || typeof rec !== 'object') return null;
  const key = typeof rec.key === 'string' ? rec.key : '';
  if (!/^[a-z0-9]+( [a-z0-9]+)*$/.test(key) || key.length > 120 || !isLat(rec.lat) || !isLon(rec.lon)) return null;
  if (!Number.isInteger(rec.n) || rec.n < 1 || !(rec.updatedAt > 0)) return null;
  return { key, label: cleanLabel(typeof rec.label === 'string' ? rec.label : '') || key,
    lat: round(rec.lat, 6), lon: round(rec.lon, 6), n: rec.n, updatedAt: rec.updatedAt };
}

/** Same 0.05° grid as "Vicino a me". */
export function cellOf(lat, lon) {
  return `${Math.floor(lat / LEG_CELL_DEG)}:${Math.floor(lon / LEG_CELL_DEG)}`;
}

/** Hour band of the day, local time: 0 = 00–03 … 7 = 21–24. */
export function hourBand(ts) {
  return Math.floor(new Date(ts).getHours() / LEG_BAND_HOURS);
}

/**
 * One measured leg: the time between two consecutive "Fatto", reduced to its two cells and its hour
 * band. Null when the duration is not a believable leg.
 * @param {{lat:number, lon:number}} from @param {{lat:number, lon:number}} to
 * @param {number} startAt @param {number} endAt
 * @returns {{id:string, from:string, to:string, band:number, sec:number}|null}
 */
export function legSample(from, to, startAt, endAt) {
  const ms = endAt - startAt;
  if (!(ms >= LEG_MIN_MS && ms <= LEG_MAX_MS)) return null;
  const a = cellOf(from.lat, from.lon);
  const b = cellOf(to.lat, to.lon);
  const band = hourBand(startAt);
  return { id: `${a}>${b}|${band}`, from: a, to: b, band, sec: Math.round(ms / 1000) };
}

/**
 * Mean and count after one more sample.
 * @param {LegTime|null|undefined} prev
 * @param {{id:string, from:string, to:string, band:number, sec:number}} sample @param {number} now
 * @returns {LegTime}
 */
export function addLegSample(prev, sample, now) {
  const n = (prev?.n ?? 0) + 1;
  const meanS = ((prev?.meanS ?? 0) * (n - 1) + sample.sec) / n;
  return { id: sample.id, from: sample.from, to: sample.to, band: sample.band, meanS: round(meanS, 1), n,
    updatedAt: now };
}

/**
 * The opposite of addLegSample ("Annulla"). @param {LegTime|null|undefined} rec @param {number} sec
 * @param {number} now @returns {LegTime|null} null = delete the record
 */
export function removeLegSample(rec, sec, now) {
  if (!rec || rec.n <= 1) return null;
  const n = rec.n - 1;
  return { ...rec, meanS: Math.max(0, round((rec.meanS * rec.n - sec) / n, 1)), n, updatedAt: now };
}

const CELL_RE = /^-?\d+:-?\d+$/;

/** `legTimes` store record. @returns {LegTime|null} */
export function validateLegTime(rec) {
  if (rec === null || typeof rec !== 'object') return null;
  if (!CELL_RE.test(rec.from) || !CELL_RE.test(rec.to)) return null;
  if (!Number.isInteger(rec.band) || rec.band < 0 || rec.band >= 24 / LEG_BAND_HOURS) return null;
  if (rec.id !== `${rec.from}>${rec.to}|${rec.band}`) return null;
  if (!Number.isInteger(rec.n) || rec.n < 1 || !(rec.meanS >= 0) || !(rec.updatedAt > 0)) return null;
  return { id: rec.id, from: rec.from, to: rec.to, band: rec.band, meanS: rec.meanS, n: rec.n,
    updatedAt: rec.updatedAt };
}
