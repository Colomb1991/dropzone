// @ts-check
// Geolocation engine: provider → filter → lastFix (memory only) → listeners and geo:fix.
import * as events from '../events.js';
import * as store from '../store.js';
import * as log from '../log.js';
import { now } from '../clock.js';
import { onTick } from '../tick.js';
import { initialFilterState, filterStep } from '../pure/geo-filter.js';
import { createRealProvider } from './provider-real.js';

/** @typedef {import('../types.js').Fix} Fix */

/** @type {import('../types.js').GeoProvider|null} */
let provider = null;
let running = false;
let stopWatch = null;
let offs = [];
let filter = initialFilterState();
/** @type {Fix|null} */
let last = null;
let lastRawAt = 0;
let impreciseSince = null;
const listeners = new Set();

const prov = () => (provider ??= createRealProvider());

function setGps(state, acc) {
  const cur = store.getState().gps;
  const a = acc === null ? null : Math.round(acc);
  if (cur.state === state && cur.acc === a) return;
  store.setState({ gps: { state, acc: a } });
  if (cur.state !== state) events.emit('geo:state', { state, acc: a });
}

function publish(fix) {
  last = fix;
  for (const cb of [...listeners]) {
    try {
      cb(fix);
    } catch (err) {
      log.error('geo', err);
    }
  }
  events.emit('geo:fix', fix);
}

function onRaw(raw) {
  lastRawAt = now();
  const r = filterStep(filter, raw);
  filter = r.state;
  if (!r.fix) return;
  const acc = r.fix.acc;
  // SPEC 3.1: imprecise = accuracy over 50 m for 15 s; coarse = over 1000 m.
  if (acc > 50) impreciseSince ??= r.fix.ts;
  else impreciseSince = null;
  if (acc > 1000) setGps('coarse', acc);
  else if (impreciseSince !== null && r.fix.ts - impreciseSince >= 15000) setGps('imprecise', acc);
  else setGps('ok', acc);
  publish(r.fix);
}

function onError(code) {
  if (code === 'denied') {
    setGps('denied', null);
    unwatch();
  } else if (code === 'unavailable' && !last) {
    setGps('unavailable', null);
  }
}

function unwatch() {
  if (stopWatch) stopWatch();
  stopWatch = null;
}

function watch() {
  unwatch();
  filter = initialFilterState();
  lastRawAt = now();
  stopWatch = prov().watch(onRaw, onError);
}

/** Default: the real provider. The sandbox swaps in the simulated one. */
export function setProvider(p) {
  const was = running;
  if (was) stop();
  provider = p;
  last = null;
  if (was) start();
}

/** Idempotent. Call inside the tap that starts the shift (permission prompt). */
export function start() {
  if (running) {
    // "Attiva" after a refusal: the watch was stopped, so ask again.
    if (store.getState().gps.state === 'denied') {
      setGps('starting', null);
      watch();
    }
    return;
  }
  running = true;
  impreciseSince = null;
  setGps('starting', null);
  watch();
  offs = [
    // Watchdog: no fix for 20 s while visible → new watch.
    onTick((t) => {
      const s = store.getState().gps.state;
      if (!running || s === 'denied' || t - lastRawAt < 20000) return;
      setGps('paused', null);
      watch();
    }, 5000),
    events.on('app:visible', () => {
      if (!running || store.getState().gps.state === 'denied') return;
      watch();
      events.emit('geo:resumed', {});
    }),
  ];
}

export function stop() {
  if (!running) return;
  running = false;
  unwatch();
  for (const off of offs) off();
  offs = [];
  setGps('off', null);
}

export function isRunning() {
  return running;
}

/** Memory only, never persisted. @returns {Fix|null} */
export function lastFix() {
  return last;
}

/** At most one call per second. @param {(f:Fix)=>void} cb @returns {() => void} */
export function onFix(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * One-shot position (outside a shift, pocket mode, SOS). Never throws.
 * @param {{timeoutMs?:number, maxAgeMs?:number}} [opts] defaults 8000 / 60000
 * @returns {Promise<Fix|null>}
 */
export async function currentPosition(opts = {}) {
  const maxAgeMs = opts.maxAgeMs ?? 60000;
  if (running && last && now() - last.ts <= Math.min(maxAgeMs, 5000)) return last;
  try {
    const raw = await prov().getOnce({ timeoutMs: opts.timeoutMs ?? 8000, maxAgeMs });
    const r = filterStep(initialFilterState(), raw);
    if (!r.fix) return null;
    if (!running) {
      // A reading that works again ends "Posizione spenta".
      if (store.getState().gps.state === 'denied') setGps('off', null);
      publish(r.fix);
    }
    return r.fix;
  } catch (err) {
    const code = /** @type {any} */ (err)?.message;
    if (code === 'denied' && !running) setGps('denied', null);
    log.warn('geo', 'once-failed', { code: String(code ?? '') });
    return null;
  }
}
