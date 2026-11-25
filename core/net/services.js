// @ts-check
// The complete list of what the app may contact (DECISIONS 4). Must equal the CSP connect-src
// and ALLOWED_HOSTS in sw.js.

/** @typedef {'tiles'|'overpass'} ServiceId */

/** @type {Record<ServiceId, {setting:string, endpoints:string[], probe:string, timeoutMs:number}>} */
export const SERVICES = {
  tiles: {
    setting: 'svc.tiles',
    endpoints: ['https://tiles.openfreemap.org/'],
    probe: 'https://tiles.openfreemap.org/planet',
    timeoutMs: 8000,
  },
  overpass: {
    setting: 'svc.overpass',
    endpoints: ['https://overpass.private.coffee/api/interpreter', 'https://overpass-api.de/api/interpreter'],
    probe: 'https://overpass.private.coffee/api/status',
    timeoutMs: 12000,
  },
};

/** @returns {string[]} every allowed cross-origin host */
export function allowedHosts() {
  const hosts = new Set();
  for (const s of Object.values(SERVICES)) for (const e of s.endpoints) hosts.add(new URL(e).host);
  return [...hosts];
}

/** SPEC 6.8 tag list. */
export const OVERPASS_AMENITIES = ['toilets', 'drinking_water', 'fuel', 'cafe', 'bar', 'pharmacy', 'fast_food'];
export const OVERPASS_SHOPS = ['supermarket', 'mall'];
