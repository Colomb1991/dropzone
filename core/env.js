// @ts-check
import { APP_SLUG, APP_URL_OVERRIDE } from '../config/app.js';

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent || '');

/** @returns {'ios'|'android'|'other'} */
export function os() {
  const s = ua();
  if (/iPhone|iPad|iPod/.test(s)) return 'ios';
  // iPadOS reports a Mac user agent.
  if (/Macintosh/.test(s) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) return 'ios';
  return /Android/.test(s) ? 'android' : 'other';
}

/** @returns {[number, number]|null} */
export function iosVersion() {
  if (os() !== 'ios') return null;
  const m = /OS (\d+)_(\d+)/.exec(ua()) ?? /Version\/(\d+)\.(\d+)/.exec(ua());
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || /** @type {any} */ (navigator).standalone === true;
}

export function isIosTab() {
  return os() === 'ios' && !isStandalone();
}

/** UNVERIFIED list of in-app browsers. */
export function inAppBrowser() {
  return /FBAN|FBAV|Instagram|Line\/|Telegram/.test(ua());
}

export function online() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** Path of the app scope, with both slashes: '/dropzone/' or '/'. */
export function scopePath() {
  if (typeof document === 'undefined') return '/';
  return new URL('./', document.baseURI).pathname;
}

/** Last path segment of the scope; the slug on a bare origin (localhost). */
export function scopeId() {
  const segs = scopePath().split('/').filter(Boolean);
  return segs.length ? segs[segs.length - 1] : APP_SLUG;
}

/** The app's own address, derived from the page (DECISIONS 11). Ends with '/'. */
export function appUrl() {
  if (APP_URL_OVERRIDE) return APP_URL_OVERRIDE;
  return typeof document === 'undefined' ? './' : new URL('./', document.baseURI).href;
}

/** Full reload at the app root. A plain navigation to the same page with another hash would not reload. */
export function reloadApp() {
  if (typeof location === 'undefined') return;
  history.replaceState(null, '', new URL('./', document.baseURI).href);
  location.reload();
}

/** IndexedDB name. */
export function dbName() {
  return scopeId();
}

/** Cache Storage name: '<scope path>tiles', '<scope path>app|<version>'. */
export function cacheName(kind) {
  return `${scopePath()}${kind}`;
}

/** localStorage mirror key read by theme-boot.js: '<scope path>theme', '<scope path>lang'. */
export function mirrorKey(name) {
  return `${scopePath()}${name}`;
}

export function lockName() {
  return `${APP_SLUG}:${scopeId()}:primary`;
}

export function channelName() {
  return `${APP_SLUG}:${scopeId()}:data`;
}

export function isLocalhost() {
  return typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
}
