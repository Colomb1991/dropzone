// @ts-check
// Meteo del turno (SPEC 11): what the hours ahead mean for a courier. Pure.

export const RECORD_ID = 'last';
/** A stored forecast is used for 60 minutes, then asked again. */
export const CACHE_MS = 60 * 60000;
/** How far ahead the briefing looks. */
export const WINDOW_H = 12;
/** SPEC 11 thresholds. */
export const RULES = { rainPct: 60, rainMm: 0.5, heatC: 32, iceC: 0, gustKmh: 60 };
const MAX_HOURS = 48;

/** @typedef {{at:number, temp:number|null, feels:number|null, rainPct:number|null, rainMm:number|null,
 *   gust:number|null}} Hour  `at`: start of the hour, epoch ms */
/** @typedef {{id:string, lat:number, lon:number, fetchedAt:number, hours:Hour[]}} WeatherRecord
 *   `lat`/`lon`: the position rounded to 1 decimal that was sent, never the exact one */
/** @typedef {{kind:'rain'|'wind', at:number, now:boolean} | {kind:'heat', max:number} | {kind:'ice'}} Warning */

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * The service's `hourly` lists (one value per hour, `time` in epoch seconds) → one object per hour.
 * @param {any} hourly @returns {Hour[]}
 */
export function toHours(hourly) {
  if (!isObj(hourly) || !Array.isArray(hourly.time)) return [];
  const pick = (name, i) => (Array.isArray(hourly[name]) ? num(hourly[name][i]) : null);
  /** @type {Hour[]} */
  const out = [];
  hourly.time.slice(0, MAX_HOURS).forEach((sec, i) => {
    if (num(sec) === null || sec <= 0) return;
    out.push({ at: sec * 1000, temp: pick('temperature_2m', i), feels: pick('apparent_temperature', i),
      rainPct: pick('precipitation_probability', i), rainMm: pick('precipitation', i), gust: pick('wind_gusts_10m', i) });
  });
  return out.sort((a, b) => a.at - b.at);
}

/** `weather` record. @returns {WeatherRecord|null} */
export function validateWeather(rec) {
  if (!isObj(rec)) return null;
  const r = /** @type {any} */ (rec);
  if (r.id !== RECORD_ID || num(r.fetchedAt) === null || r.fetchedAt <= 0 || !Array.isArray(r.hours)) return null;
  if (num(r.lat) === null || num(r.lon) === null || Math.abs(r.lat) > 90 || Math.abs(r.lon) > 180) return null;
  /** @type {Hour[]} */
  const hours = [];
  for (const h of r.hours.slice(0, MAX_HOURS)) {
    if (!isObj(h) || num(h.at) === null || h.at <= 0) return null;
    hours.push({ at: h.at, temp: num(h.temp), feels: num(h.feels), rainPct: num(h.rainPct), rainMm: num(h.rainMm),
      gust: num(h.gust) });
  }
  // One decimal only: a finer position must never be stored here.
  return { id: RECORD_ID, lat: Math.round(r.lat * 10) / 10, lon: Math.round(r.lon * 10) / 10,
    fetchedAt: r.fetchedAt, hours };
}

/** @param {{lat:number, lon:number, hourly:any}} answer the gateway's answer @param {number} now */
export function makeRecord(answer, now) {
  return validateWeather({ id: RECORD_ID, lat: answer?.lat, lon: answer?.lon, fetchedAt: now,
    hours: toHours(answer?.hourly) });
}

/** @param {WeatherRecord|null} rec @param {number} now */
export function isFresh(rec, now) {
  return Boolean(rec) && now >= /** @type {WeatherRecord} */ (rec).fetchedAt
    && now - /** @type {WeatherRecord} */ (rec).fetchedAt < CACHE_MS;
}

/**
 * What to warn about in the next 12 hours, most useful first: rain, ice, heat, wind.
 * @param {Hour[]} hours @param {number} now
 * @returns {Warning[]|null} null when the forecast says nothing about these hours
 */
export function warnings(hours, now) {
  // The hour in progress counts; an hour that has ended does not.
  const win = hours.filter((h) => h.at > now - 3600000 && h.at <= now + WINDOW_H * 3600000);
  if (!win.length) return null;
  /** @type {Warning[]} */
  const out = [];
  // Without a probability the amount alone decides.
  const rain = win.find((h) => (h.rainMm ?? 0) >= RULES.rainMm && (h.rainPct === null || h.rainPct >= RULES.rainPct));
  if (rain) out.push({ kind: 'rain', at: rain.at, now: rain.at <= now });
  const temps = /** @type {number[]} */ (win.map((h) => h.temp).filter((v) => v !== null));
  if (temps.length && Math.min(...temps) <= RULES.iceC) out.push({ kind: 'ice' });
  const feels = /** @type {number[]} */ (win.map((h) => h.feels).filter((v) => v !== null));
  if (feels.length && Math.max(...feels) >= RULES.heatC) out.push({ kind: 'heat', max: Math.round(Math.max(...feels)) });
  const wind = win.find((h) => (h.gust ?? 0) >= RULES.gustKmh);
  if (wind) out.push({ kind: 'wind', at: wind.at, now: wind.at <= now });
  return out;
}

/** "15": the local hour of a time, as the briefing says it. */
export function hourLabel(at) {
  return String(new Date(at).getHours());
}

/**
 * The one briefing line: at most two warnings, or the calm sentence.
 * @param {Warning[]} list @param {(key:string, params?:object)=>string} t
 * @returns {{icon:string, text:string}}
 */
export function briefingLine(list, t) {
  if (!list.length) return { icon: 'sun', text: t('meteo.calm') };
  const say = (w) => {
    if (w.kind === 'rain') return w.now ? t('meteo.rain.now') : t('meteo.rain.later', { hour: hourLabel(w.at) });
    if (w.kind === 'wind') return w.now ? t('meteo.wind.now') : t('meteo.wind.later', { hour: hourLabel(w.at) });
    if (w.kind === 'heat') return t('meteo.heat', { max: w.max });
    return t('meteo.ice');
  };
  const first = list[0].kind;
  return { icon: first === 'rain' ? 'cloud-rain' : first === 'heat' ? 'sun' : 'triangle-alert',
    text: list.slice(0, 2).map(say).join(' ') };
}
