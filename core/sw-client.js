// @ts-check
// Page side of the service worker (ARCHITECTURE 3 and 0.0 row 3). sw.js itself is not in core.
import * as store from './store.js';
import * as events from './events.js';
import * as settings from './settings.js';
import * as env from './env.js';
import * as log from './log.js';
import { now } from './clock.js';
import { updateAction, updateCheckDue } from './pure/update-policy.js';

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

/**
 * The one reload that puts the new version on screen. The flag lives for this reload only: the next
 * boot reads it to say "App aggiornata." once and to never apply two updates in a row.
 */
function reloadUpdated() {
  try {
    sessionStorage.setItem(env.mirrorKey('updated'), '1');
  } catch (err) {
    log.warn('sw', 'flag-failed');
  }
  location.reload();
}

/** Boot: true once, on the start that follows an applied update. */
export function takeUpdated() {
  try {
    const key = env.mirrorKey('updated');
    if (sessionStorage.getItem(key) !== '1') return false;
    sessionStorage.removeItem(key);
    return true;
  } catch (err) {
    return false;
  }
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
  const track = (/** @type {ServiceWorker|null} */ w) => w?.addEventListener('statechange', () => {
    if (w.state === 'installed') markReady();
  });
  // The browser checks by itself at every start: that install may be running before this line.
  track(r.installing);
  r.addEventListener('updatefound', () => track(r.installing));
  c.addEventListener('controllerchange', () => {
    if (asked) reloadUpdated();
  });
  markReady();
  postTiles();
  settings.onChange('svc.tiles', postTiles);
  events.on('app:visible', () => checkForUpdate());
  return true;
}

/** At start (`force`) and on every return to the foreground, at most once every 15 minutes. */
export async function checkForUpdate(force = false) {
  if (!reg || (!force && !updateCheckDue(now(), lastCheckAt))) return;
  lastCheckAt = now();
  try {
    await reg.update();
  } catch (err) {
    log.warn('sw', 'update-check-failed');
  }
}

/**
 * Boot, before first render: a waiting worker is applied when this window is the primary, also with
 * a shift open (it is in the database and session.resumeIfOpen() picks it up after the reload).
 * Resolves true when the page is about to reload.
 * @param {{justUpdated:boolean}} opts justUpdated: this start is already the reload of an update
 */
export async function applyWaitingAtBoot(opts) {
  const c = sw();
  if (!c) return false;
  const r = await c.getRegistration('./');
  const s = store.getState();
  const plan = updateAction({ boot: true, waiting: Boolean(r?.waiting && c.controller), primary: s.primary,
    moving: s.moving, justUpdated: opts.justUpdated });
  if (plan !== 'apply') return false;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 3000);
    c.addEventListener('controllerchange', () => {
      clearTimeout(timer);
      resolve(true);
      reloadUpdated();
    }, { once: true });
    r?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  });
}

/**
 * Banner "Nuova versione pronta." and row "Aggiorna l'app": only the primary window and only when
 * stopped, also during a shift. The page reloads as soon as the new worker takes control.
 */
export function applyUpdate() {
  const s = store.getState();
  const w = reg?.waiting;
  if (!w || updateAction({ waiting: true, primary: s.primary, moving: s.moving }) !== 'offer') return false;
  asked = true;
  w.postMessage({ type: 'SKIP_WAITING' });
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
