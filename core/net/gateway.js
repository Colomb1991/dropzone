// @ts-check
// The single network door: the only file of the app that performs a request.
// Order of checks: sandbox → user setting → offline → back-off → request.
import * as store from '../store.js';
import * as settings from '../settings.js';
import * as env from '../env.js';
import * as log from '../log.js';
import { now } from '../clock.js';
import { AppError } from '../errors.js';
import { round } from '../pure/geo-math.js';
import { SERVICES, PHOTON, WEATHER, OVERPASS_AMENITIES, OVERPASS_SHOPS } from './services.js';

/** @typedef {import('./services.js').ServiceId} ServiceId */
/** @typedef {'ok'|'user-off'|'sandbox'|'offline'} ServiceReason */

const CELL = 0.05;
const MAX_BODY = 5 * 1024 * 1024;
const CACHE_MS = 600000;
const RETRY_SAME_CELL_MS = 5000;
const BACKOFF_MS = 60000;

export class NetError extends AppError {
  /** @param {'service-off'|'offline'|'timeout'|'http'|'rate-limited'|'bad-response'|'blocked'} code */
  constructor(code, service, status = null) {
    super(code, code === 'offline' ? 'core.err.offline' : code === 'service-off' ? 'core.err.serviceOff' : 'core.err.network');
    this.name = 'NetError';
    this.service = service;
    this.status = status;
  }
}

const deps = {
  request: (url, init) => fetch(url, init),
  setting: (key) => settings.get(key),
  sandbox: () => store.getState().sandbox,
  online: () => env.online(),
  now: () => now(),
};

/** @type {Record<string, {requests:number, errors:number, lastAt:number|null}>} */
let counters = {};
/** @type {Map<string, {at:number, value:any}>} */
let cache = new Map();
/** @type {Map<string, Promise<any>>} */
let inflight = new Map();
/** @type {Map<string, number>} */
let lastTry = new Map();
let backoffUntil = 0;
let photonLastAt = -Infinity;
let weatherLastAt = -Infinity;

/** Tests only: inject a fake transport and state; resets counters and caches. */
export function _setDeps(over) {
  Object.assign(deps, over);
  counters = {};
  cache = new Map();
  inflight = new Map();
  lastTry = new Map();
  backoffUntil = 0;
  photonLastAt = -Infinity;
  weatherLastAt = -Infinity;
}

function count(id, failed) {
  const c = (counters[id] ??= { requests: 0, errors: 0, lastAt: null });
  c.requests++;
  if (failed) c.errors++;
  c.lastAt = deps.now();
}

/** @param {ServiceId} id @returns {{allowed:boolean, reason:ServiceReason}} */
export function serviceState(id) {
  if (deps.sandbox()) return { allowed: false, reason: 'sandbox' };
  if (!SERVICES[id] || deps.setting(SERVICES[id].setting) !== true) return { allowed: false, reason: 'user-off' };
  if (!deps.online()) return { allowed: false, reason: 'offline' };
  return { allowed: true, reason: 'ok' };
}

function check(id) {
  const s = serviceState(id);
  if (!s.allowed) throw new NetError(s.reason === 'offline' ? 'offline' : 'service-off', id);
}

async function send(id, url, init, timeoutMs, signal) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const onAbort = () => ctl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await deps.request(url, {
      ...init, signal: ctl.signal, credentials: 'omit', cache: 'no-store', redirect: 'error',
      referrerPolicy: 'strict-origin-when-cross-origin',
    });
    count(id, !res.ok);
    return res;
  } catch (err) {
    count(id, true);
    throw new NetError('timeout', id);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

async function readJson(id, res) {
  const text = await res.text();
  if (text.length > MAX_BODY) throw new NetError('bad-response', id);
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new NetError('bad-response', id);
  }
}

// ---- pure helpers, exported for tests and for feature `vicino` ----

/** @returns {string} `${Math.floor(lat / 0.05)}:${Math.floor(lon / 0.05)}` */
export function cellIdOf(lat, lon) {
  return `${Math.floor(lat / CELL)}:${Math.floor(lon / CELL)}`;
}

/** @returns {{south:number, west:number, north:number, east:number}} */
export function cellBbox(cellId) {
  const m = /^(-?\d+):(-?\d+)$/.exec(cellId);
  if (!m) throw new NetError('blocked', 'overpass');
  const south = round(Number(m[1]) * CELL, 2);
  const west = round(Number(m[2]) * CELL, 2);
  if (Math.abs(south) > 90 || Math.abs(west) > 180) throw new NetError('blocked', 'overpass');
  return { south, west, north: round(south + CELL, 2), east: round(west + CELL, 2) };
}

/** Fixed query: only the cell bbox varies. */
export function overpassQuery(cellId) {
  const b = cellBbox(cellId);
  return `[out:json][timeout:10][bbox:${b.south},${b.west},${b.north},${b.east}];`
    + `(nwr["amenity"~"^(${OVERPASS_AMENITIES.join('|')})$"];nwr["shop"~"^(${OVERPASS_SHOPS.join('|')})$"];);`
    + 'out center tags qt 1500;';
}

/** The text as it is sent to Photon: no control characters, single spaces. */
export function photonText(text) {
  return String(text ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Fixed request: only the text and the bias vary, and the bias is rounded here to 1 decimal
 * (about 10 km), so no caller can send a finer position.
 * @param {string} text already cleaned @param {{lat:number, lon:number}|null} [bias]
 */
export function photonUrl(text, bias) {
  let url = `${SERVICES.photon.endpoints[0]}?q=${encodeURIComponent(text)}&limit=${PHOTON.limit}&lang=${PHOTON.lang}`;
  if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lon) && Math.abs(bias.lat) <= 90
    && Math.abs(bias.lon) <= 180) {
    url += `&lat=${round(bias.lat, PHOTON.biasDecimals)}&lon=${round(bias.lon, PHOTON.biasDecimals)}`;
  }
  return url;
}

/**
 * Fixed request: only the position varies, and it is rounded here to 1 decimal (about 10 km), so no
 * caller can send a finer one. An impossible position is refused.
 * @param {number} lat @param {number} lon
 */
export function weatherUrl(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)
    || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new NetError('blocked', 'weather');
  // `+ 0` turns a rounded -0 into 0.
  return `${SERVICES.weather.endpoints[0]}?latitude=${round(lat, WEATHER.decimals) + 0}`
    + `&longitude=${round(lon, WEATHER.decimals) + 0}&hourly=${WEATHER.hourly.join(',')}`
    + `&forecast_hours=${WEATHER.hours}&timeformat=unixtime`;
}

// ---- operations ----

/**
 * One Overpass request per fixed 0.05° cell. Primary, then the fallback once, then a 60 s stop.
 * @param {string} cellId @param {{signal?:AbortSignal}} [opts]
 * @returns {Promise<{elements: object[], endpoint: string}>}
 */
export async function overpassCell(cellId, opts = {}) {
  const query = overpassQuery(cellId);
  check('overpass');
  const t = deps.now();
  const hit = cache.get(cellId);
  if (hit && t - hit.at < CACHE_MS) return Promise.resolve(hit.value);
  const running = inflight.get(cellId);
  if (running) return running;
  if (t < backoffUntil || t - (lastTry.get(cellId) ?? -Infinity) < RETRY_SAME_CELL_MS) {
    return Promise.reject(new NetError('rate-limited', 'overpass'));
  }
  lastTry.set(cellId, t);
  const job = (async () => {
    const svc = SERVICES.overpass;
    let lastErr = new NetError('timeout', 'overpass');
    for (const endpoint of svc.endpoints) {
      try {
        const res = await send('overpass', endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        }, svc.timeoutMs, opts.signal);
        if (!res.ok) {
          lastErr = new NetError('http', 'overpass', res.status);
          if (res.status === 429 || res.status === 504) continue;
          throw lastErr;
        }
        const json = await readJson('overpass', res);
        if (!json || !Array.isArray(json.elements)) throw new NetError('bad-response', 'overpass');
        const value = { elements: json.elements, endpoint: new URL(endpoint).host };
        cache.set(cellId, { at: deps.now(), value });
        return value;
      } catch (err) {
        if (!(err instanceof NetError) || err.code !== 'timeout') throw err;
        lastErr = err;
      }
    }
    backoffUntil = deps.now() + BACKOFF_MS;
    log.warn('net', 'overpass-backoff');
    throw lastErr.code === 'http' ? new NetError('rate-limited', 'overpass', lastErr.status) : lastErr;
  })();
  inflight.set(cellId, job);
  const clear = () => inflight.delete(cellId);
  job.then(clear, clear);
  return job;
}

/**
 * Address search for the route planner (Photon, OpenStreetMap data). Sends the typed text and, when
 * given, a position rounded to 1 decimal. At most one request every 400 ms; identical questions are
 * answered from memory for 5 minutes.
 * @param {string} text 3 to 120 characters
 * @param {{lat:number, lon:number}|null} [bias] @param {{signal?:AbortSignal}} [opts]
 * @returns {Promise<{features: object[]}>}
 */
export async function photonSearch(text, bias = null, opts = {}) {
  const q = photonText(text);
  if (q.length < PHOTON.minChars || q.length > PHOTON.maxChars) throw new NetError('blocked', 'photon');
  check('photon');
  const url = photonUrl(q, bias);
  const key = `photon|${url}`;
  const t = deps.now();
  const hit = cache.get(key);
  if (hit && t - hit.at < PHOTON.cacheMs) return hit.value;
  const running = inflight.get(key);
  if (running) return running;
  if (t - photonLastAt < PHOTON.minIntervalMs) throw new NetError('rate-limited', 'photon');
  photonLastAt = t;
  const job = (async () => {
    const res = await send('photon', url, { method: 'GET' }, SERVICES.photon.timeoutMs, opts.signal);
    if (!res.ok) throw new NetError(res.status === 429 ? 'rate-limited' : 'http', 'photon', res.status);
    const json = await readJson('photon', res);
    if (!json || !Array.isArray(json.features)) throw new NetError('bad-response', 'photon');
    const value = { features: json.features.slice(0, PHOTON.limit) };
    cache.set(key, { at: deps.now(), value });
    return value;
  })();
  inflight.set(key, job);
  const clear = () => inflight.delete(key);
  job.then(clear, clear);
  return job;
}

/**
 * Forecast of the next hours for the shift briefing (Open-Meteo). Sends the position rounded to
 * 1 decimal and nothing else. One answer per rounded position is kept in memory for 60 minutes; a
 * new position is asked at most once a minute.
 * @param {number} lat @param {number} lon @param {{signal?:AbortSignal}} [opts]
 * @returns {Promise<{lat:number, lon:number, hourly:Record<string, number[]>}>} `lat`/`lon`: the rounded
 *   position that was sent; `hourly.time` in epoch seconds, plus the fixed lists of WEATHER.hourly
 */
export async function weatherForecast(lat, lon, opts = {}) {
  const url = weatherUrl(lat, lon);
  check('weather');
  const key = `weather|${url}`;
  const t = deps.now();
  const hit = cache.get(key);
  if (hit && t - hit.at < WEATHER.cacheMs) return hit.value;
  const running = inflight.get(key);
  if (running) return running;
  if (t - weatherLastAt < WEATHER.minIntervalMs) throw new NetError('rate-limited', 'weather');
  weatherLastAt = t;
  const job = (async () => {
    const res = await send('weather', url, { method: 'GET' }, SERVICES.weather.timeoutMs, opts.signal);
    if (!res.ok) throw new NetError(res.status === 429 ? 'rate-limited' : 'http', 'weather', res.status);
    const json = await readJson('weather', res);
    const h = json?.hourly;
    if (!h || typeof h !== 'object' || !Array.isArray(h.time)) throw new NetError('bad-response', 'weather');
    /** @type {Record<string, number[]>} */
    const hourly = { time: h.time.slice(0, 48) };
    for (const name of WEATHER.hourly) hourly[name] = Array.isArray(h[name]) ? h[name].slice(0, 48) : [];
    const value = { lat: round(lat, WEATHER.decimals) + 0, lon: round(lon, WEATHER.decimals) + 0, hourly };
    cache.set(key, { at: deps.now(), value });
    return value;
  })();
  inflight.set(key, job);
  const clear = () => inflight.delete(key);
  job.then(clear, clear);
  return job;
}

/**
 * A static file of the app itself. Same-origin relative path only.
 * @param {string} path @param {{as:'json'|'text'|'blob', timeoutMs?:number}} opts
 */
export async function local(path, opts) {
  if (typeof path !== 'string' || path.startsWith('/') || path.includes('..') || path.includes('//')
    || path.includes(':') || path.includes('\\')) throw new NetError('blocked', 'local');
  const base = env.appUrl();
  const url = /^https?:/.test(base) ? new URL(path, base).href : `./${path}`;
  const res = await send('local', url, { method: 'GET' }, opts.timeoutMs ?? 8000);
  if (!res.ok) throw new NetError('http', 'local', res.status);
  try {
    if (opts.as === 'blob') return await res.blob();
    if (opts.as === 'text') return await res.text();
    return await res.json();
  } catch (err) {
    throw new NetError('bad-response', 'local');
  }
}

/**
 * MapLibre transformRequest: own-origin files and, while "Mappa online" is on, the tile host.
 * Anything else throws NetError('blocked'); the map wrapper then answers with config/blocked.json.
 * @param {string} url @returns {{url:string}}
 */
export function guardMapUrl(url) {
  let u;
  try {
    const base = env.appUrl();
    u = /^https?:/.test(base) ? new URL(url, base) : new URL(url);
  } catch (err) {
    throw new NetError('blocked', 'tiles');
  }
  if (typeof location !== 'undefined' && u.origin === location.origin) return { url: u.href };
  const host = new URL(SERVICES.tiles.endpoints[0]).host;
  if (u.protocol === 'https:' && u.host === host && serviceState('tiles').allowed) {
    count('tiles', false);
    return { url: u.href };
  }
  throw new NetError('blocked', 'tiles');
}

/** Diagnostics: a fixed request, never the user's position. */
export async function probe(id) {
  const t0 = deps.now();
  try {
    check(id);
    const res = await send(id, SERVICES[id].probe, { method: 'GET' }, SERVICES[id].timeoutMs);
    return { ok: res.ok, ms: deps.now() - t0, status: res.status };
  } catch (err) {
    return { ok: false, ms: deps.now() - t0, status: null };
  }
}

/** Requests of this session, per service; shown in Diagnostics. */
export function stats() {
  const out = {};
  for (const id of ['tiles', 'overpass', 'photon', 'weather', 'local']) out[id] = { ...(counters[id] ?? { requests: 0, errors: 0, lastAt: null }) };
  return out;
}
