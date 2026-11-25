// @ts-check
// Furgone qui (SPEC 11): the one saved parking point and what the screen says about it. Pure.
import { distM, round } from '../../../core/pure/geo-math.js';
import { isLat, isLon } from '../../../core/pure/validators.js';

export const SPOT_ID = 'van';
/** The point deletes itself: nobody looks for the parking of the day before. */
export const MAX_AGE_MS = 24 * 3600000;
/** Under this distance the courier is at the van. */
export const HERE_M = 25;
/** An easy walking pace with a parcel in hand. */
const WALK_M_PER_MIN = 75;

/** @typedef {{id:string, lat:number, lon:number, acc:number|null, at:number}} Spot */

const isTs = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const accOf = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);

/** `vanSpot` record. @returns {Spot|null} */
export function validateSpot(rec) {
  if (rec === null || typeof rec !== 'object' || Array.isArray(rec)) return null;
  const r = /** @type {any} */ (rec);
  if (r.id !== SPOT_ID || !isLat(r.lat) || !isLon(r.lon) || !isTs(r.at)) return null;
  return { id: SPOT_ID, lat: r.lat, lon: r.lon, acc: accOf(r.acc), at: r.at };
}

/**
 * The point saved by "Il furgone è qui".
 * @param {{lat:number, lon:number, acc?:number|null}|null} pos @param {number} now @returns {Spot|null}
 */
export function makeSpot(pos, now) {
  if (!pos) return null;
  return validateSpot({ id: SPOT_ID, lat: round(pos.lat, 6), lon: round(pos.lon, 6), acc: pos.acc ?? null, at: now });
}

/** @param {Spot} spot @param {number} now */
export function isExpired(spot, now) {
  return now - spot.at > MAX_AGE_MS;
}

/** Metres from `here` to the van, or null without a position. */
export function distanceM(spot, here) {
  if (!spot || !here || !isLat(here.lat) || !isLon(here.lon)) return null;
  return distM(here.lat, here.lon, spot.lat, spot.lon);
}

/** Whole minutes on foot, at least 1. */
export function walkMin(m) {
  return Math.max(1, Math.round(m / WALK_M_PER_MIN));
}

/** Where the map opens: on the van alone, or wide enough for the van and the courier. */
export function viewFor(spot, here) {
  const d = distanceM(spot, here);
  if (d === null) return { lat: spot.lat, lon: spot.lon, zoom: 17 };
  const zoom = d <= 150 ? 17 : d <= 400 ? 16 : d <= 900 ? 15 : d <= 2000 ? 14 : d <= 5000 ? 13 : 11;
  return { lat: (spot.lat + here.lat) / 2, lon: (spot.lon + here.lon) / 2, zoom };
}

/**
 * Walking directions open in Apple Maps only when the courier chose it; in Google Maps otherwise
 * (the third navigator has no walking mode).
 * @param {string} saved setting `nav.app` @param {string[]} apps navigators of this phone
 * @returns {'google'|'apple'}
 */
export function walkApp(saved, apps) {
  return saved === 'apple' && apps.includes('apple') ? 'apple' : 'google';
}
