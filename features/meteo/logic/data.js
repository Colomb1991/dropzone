// @ts-check
// Storage and network of the weather line: the only file of the feature that asks the gateway or
// writes to the database. One request at shift start; the answer is kept for 60 minutes.
import { t, db, clock, geo, gateway, log } from '../../../core/api.js';
import { RECORD_ID, validateWeather, makeRecord, isFresh, warnings, briefingLine } from './forecast.js';

const STORE = 'weather';
/** How long the briefing waits for the first position, then for the whole answer. */
const FIX_WAIT_MS = 3000;
const BRIEFING_WAIT_MS = 4000;
/** The shift home repeats the line only from an answer this recent. */
const CONTEXT_MAX_AGE_MS = 3 * 3600000;

/** @typedef {{rec: import('./forecast.js').WeatherRecord|null, why?: 'position'|'network'}} Outcome */

/** @type {{key:string, job:Promise<Outcome>}|null} */
let current = null;

/** Never asks the phone for the position (no prompt): the last fix, or the next one of the shift. */
function firstFix(maxMs) {
  const last = geo.lastFix();
  if (last) return Promise.resolve(last);
  return new Promise((resolve) => {
    let off = () => {};
    const timer = setTimeout(() => {
      off();
      resolve(null);
    }, maxMs);
    off = geo.onFix((fix) => {
      clearTimeout(timer);
      off();
      resolve(fix);
    });
  });
}

/** Is the service usable at all? Off in Settings and in the demo there is no line and no request. */
function switchedOn() {
  const reason = gateway.serviceState('weather').reason;
  return reason !== 'user-off' && reason !== 'sandbox';
}

/** @returns {Promise<Outcome>} */
async function load() {
  const saved = validateWeather(await db.get(STORE, RECORD_ID));
  if (saved && isFresh(saved, clock.now())) return { rec: saved };
  const fix = await firstFix(FIX_WAIT_MS);
  if (!fix) return { rec: null, why: 'position' };
  try {
    // The gateway rounds the position to 1 decimal: nothing finer leaves the phone or is stored.
    const rec = makeRecord(await gateway.weatherForecast(fix.lat, fix.lon), clock.now());
    if (!rec) return { rec: null, why: 'network' };
    await db.put(STORE, rec);
    return { rec };
  } catch (err) {
    log.warn('meteo', 'forecast-failed', { code: String(/** @type {any} */ (err)?.code ?? '') });
    return { rec: null, why: 'network' };
  }
}

/**
 * Starts (once per shift) the forecast of the shift that has just begun.
 * @param {string} [key] the shift id @returns {Promise<Outcome|null>} null when the service is off
 */
export function warm(key = '') {
  if (!switchedOn()) return Promise.resolve(null);
  if (!current || current.key !== key) {
    current = { key, job: load().catch((err) => {
      log.error('meteo', err);
      return /** @type {Outcome} */ ({ rec: null, why: 'network' });
    }) };
  }
  return current.job;
}

/**
 * `briefing` slot: one row, or none while the service is off. Never holds the briefing for long:
 * an answer that comes late is stored and shown at the next briefing within the hour.
 * @param {{now?:number, shift?:{id:string}}} [ctx] @returns {Promise<{icon:string, text:string}[]>}
 */
export async function briefing(ctx) {
  const late = new Promise((resolve) => {
    setTimeout(() => resolve('late'), BRIEFING_WAIT_MS);
  });
  const res = await Promise.race([warm(ctx?.shift?.id ?? ''), late]);
  if (res === null || res === 'late') return [];
  const out = /** @type {Outcome} */ (res);
  const list = out.rec ? warnings(out.rec.hours, ctx?.now ?? clock.now()) : null;
  if (list) return [briefingLine(list, t)];
  return [{ icon: 'cloud-rain', text: out.why === 'position' ? t('meteo.noPosition') : t('meteo.unavailable') }];
}

/**
 * `shift.context` slot: the briefing line again, from the answer already stored (never a request).
 * A warning ranks 30, the calm sentence 50; nothing while the service is off or the answer is old.
 * @param {{now?:number}} [ctx] @returns {Promise<{rank:number, icon:string, title:string}[]>}
 */
export async function contextRows(ctx) {
  if (!switchedOn()) return [];
  const now = ctx?.now ?? clock.now();
  const saved = validateWeather(await db.get(STORE, RECORD_ID));
  if (!saved || now - saved.fetchedAt > CONTEXT_MAX_AGE_MS) return [];
  const list = warnings(saved.hours, now);
  if (!list) return [];
  const line = briefingLine(list, t);
  return [{ rank: list.length ? 30 : 50, icon: line.icon, title: line.text }];
}
