// @ts-check
// Page side of the service worker (ARCHITECTURE 3 and 0.0 row 3). sw.js itself is not in core.
import * as store from './store.js';
import * as events from './events.js';
import * as settings from './settings.js';
import * as env from './env.js';
import * as log from './log.js';
import { now } from './clock.js';

const sw = () => (typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : null);
/** @type {ServiceWorkerRegistration|null} */
let reg = null;
let lastCheckAt = 0;
let asked = false;

function devEnabled() {
  if (!env.isLocalhost()) return true;
  try {
    return localStorage.getItem(env.mirrorKey('dev-sw')) === '1';
  } catch (err) {
    return false;
  }
}

function markReady() {
  if (!reg?.waiting || !sw()?.controller) return;
  store.setState({ updateReady: true });
  events.emit('sw:update-ready', {});
}

function postTiles() {
  sw()?.controller?.postMessage({ type: 'TILES', allowed: settings.get('svc.tiles') === true });
}

/** After first render. Not called when the boot route is the viewer and the user never onboarded. */
export async function register() {
  const c = sw();
  if (!c || !devEnabled()) return false;
  try {
    reg = await c.register('./sw.js', { scope: './', updateViaCache: 'none' });
  } catch (err) {
    log.error('sw', err);
    return false;
  }
  const r = reg;
  r.addEventListener('updatefound', () => {
    const w = r.installing;
    w?.addEventListener('statechange', () => {
      if (w.state === 'installed') markReady();
    });
  });
  c.addEventListener('controllerchange', () => {
    if (asked) location.reload();
  });
  markReady();
  postTiles();
  settings.onChange('svc.tiles', postTiles);
  events.on('app:visible', () => checkForUpdate());
  return true;
}

/** At most once per hour. */
export async function checkForUpdate(force = false) {
  if (!reg || (!force && now() - lastCheckAt < 3600000)) return;
  lastCheckAt = now();
  try {
    await reg.update();
  } catch (err) {
    log.warn('sw', 'update-check-failed');
  }
}

/**
 * Boot, before first render: a waiting worker is applied when no shift is open and this window
 * is the primary. Resolves true when the page is about to reload.
 * @param {{shiftOpen:boolean}} opts
 */
export async function applyWaitingAtBoot(opts) {
  const c = sw();
  if (!c || opts.shiftOpen || !store.getState().primary) return false;
  const r = await c.getRegistration('./');
  if (!r?.waiting || !c.controller) return false;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 3000);
    c.addEventListener('controllerchange', () => {
      clearTimeout(timer);
      resolve(true);
      location.reload();
    }, { once: true });
    r.waiting?.postMessage({ type: 'SKIP_WAITING' });
  });
}

/** Row "Aggiorna l'app": only the primary window, never during a shift. */
export function applyUpdate() {
  const s = store.getState();
  if (!reg?.waiting || !s.primary || s.shift) return false;
  asked = true;
  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

/** "Pronta anche senza rete": an active worker controls this page. */
export async function offlineReady() {
  const c = sw();
  if (!c) return false;
  const r = await c.getRegistration('./');
  return Boolean(r?.active && c.controller);
}

/** The worker's version string, or null. */
export function version() {
  const ctl = sw()?.controller;
  if (!ctl) return Promise.resolve(null);
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 1500);
    ch.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve(e.data?.version ?? null);
    };
    ctl.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
  });
}
