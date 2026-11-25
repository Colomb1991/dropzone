// @ts-check
const EARTH_R = 6371008.8;
const RAD = Math.PI / 180;

/** Metres per degree of latitude (mean sphere). */
export const M_PER_DEG_LAT = 111195;

/** Haversine distance in metres. */
export function distM(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial bearing from point 1 to point 2, 0–360 degrees. */
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * RAD;
  const p2 = lat2 * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const y = Math.sin(dLon) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** @param {number} n @param {number} decimals */
export function round(n, decimals) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Point `d` metres from (lat, lon) along `bearing` (flat approximation, fine under a few km). */
export function offsetM(lat, lon, bearing, d) {
  const b = bearing * RAD;
  return {
    lat: lat + (d * Math.cos(b)) / M_PER_DEG_LAT,
    lon: lon + (d * Math.sin(b)) / (M_PER_DEG_LAT * Math.cos(lat * RAD)),
  };
}
