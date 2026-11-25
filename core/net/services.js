// @ts-check
// The complete list of what the app may contact (DECISIONS 4). Must equal the CSP connect-src
// and ALLOWED_HOSTS in sw.js.

/** @typedef {'tiles'|'overpass'|'photon'|'weather'} ServiceId */

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
  // Giro address search. Off until the courier turns it on (svc.photon defaults to false).
  photon: {
    setting: 'svc.photon',
    endpoints: ['https://photon.komoot.io/api/'],
    // Fixed text, never a position.
    probe: 'https://photon.komoot.io/api/?q=roma&limit=1',
    timeoutMs: 8000,
  },
  // Meteo del turno (Open-Meteo). Off until the courier turns it on in Settings (svc.weather).
  weather: {
    setting: 'svc.weather',
    endpoints: ['https://api.open-meteo.com/v1/forecast'],
    // A fixed point in the middle of Italy, never a position.
    probe: 'https://api.open-meteo.com/v1/forecast?latitude=42&longitude=12&hourly=temperature_2m&forecast_hours=1',
    timeoutMs: 8000,
  },
};

/**
 * Photon request rules. `lang` is 'default' (names in the local language, Italian in Italy): the
 * public server answers HTTP 400 to `lang=it`, it knows only default, en, de and fr.
 */
export const PHOTON = {
  minChars: 3, maxChars: 120, limit: 5, lang: 'default', minIntervalMs: 400, biasDecimals: 1, cacheMs: 300000,
};

/**
 * Open-Meteo request rules: a fixed list of hourly values for the next 12 hours, the position
 * rounded to 1 decimal (about 10 km), one answer per rounded position kept for 60 minutes.
 * `timeformat=unixtime` makes every hour an epoch in seconds, so no time zone is sent or guessed.
 */
export const WEATHER = {
  decimals: 1, hours: 12, minIntervalMs: 60000, cacheMs: 3600000,
  hourly: ['temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation', 'wind_gusts_10m'],
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
