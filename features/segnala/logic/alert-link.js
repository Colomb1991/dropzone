// @ts-check
// Shared alert link (SPEC 7.3, ARCHITECTURE 0.0 row 2.12): `<base>#a=1.<payload><check>`.
import { textToBase64Url, base64UrlToText } from '../../../core/pure/base64.js';
import { cleanText, hasEnforcementWord } from '../../../core/pure/validators.js';
import { LIMITS } from '../../../core/pure/catalog.js';

export const ALERT_LINK_VERSION = 1;
export const MAX_URL_CHARS = LIMITS.alertUrl;
/** "a=1." + payload + check character. */
export const MAX_FRAGMENT_CHARS = 250;

const FRAGMENT_RE = /^a=1\.([A-Za-z0-9_-]{8,245})([A-Za-z0-9])$/;
const CHECK = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** @typedef {{type:number, lat:number, lon:number, createdAt:number, ttlMin:number, text:string}} AlertPayload */

class LinkError extends Error {
  /** @param {string} code */
  constructor(code) {
    super(code);
    this.code = code;
    this.userKey = 'segnala.err.long';
  }
}

/** One character: sum of the payload's character codes mod 62. */
export function checkChar(payload) {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) sum += payload.charCodeAt(i);
  return CHECK[sum % 62];
}

const e5 = (v) => Math.round(v * 1e5);
const minutes = (ms) => Math.floor(ms / 60000);

/** @param {AlertPayload} p @returns {string} same link twice = one record */
export function alertId(p) {
  return `a${p.type}.${e5(p.lat)}.${e5(p.lon)}.${minutes(p.createdAt)}`;
}

/** @param {AlertPayload} alert @returns {string} "a=1.<payload><check>" */
export function encodeAlert(alert) {
  const arr = [alert.type, e5(alert.lat), e5(alert.lon), minutes(alert.createdAt), Math.round(alert.ttlMin),
    cleanText(alert.text).slice(0, LIMITS.alertText)];
  const payload = textToBase64Url(JSON.stringify(arr));
  const fragment = `a=${ALERT_LINK_VERSION}.${payload}${checkChar(payload)}`;
  if (fragment.length > MAX_FRAGMENT_CHARS) throw new LinkError('alert-too-long');
  return fragment;
}

/** @param {AlertPayload} alert @param {string} baseUrl without hash */
export function buildAlertUrl(alert, baseUrl) {
  const url = `${String(baseUrl).split('#')[0]}#${encodeAlert(alert)}`;
  if (url.length > MAX_URL_CHARS) throw new LinkError('alert-too-long');
  return url;
}

/** Longest prefix of the text, cut at a word, that fits both limits. */
export function fitAlertText(alert, baseUrl) {
  let text = cleanText(alert.text).slice(0, LIMITS.alertText);
  for (;;) {
    try {
      buildAlertUrl({ ...alert, text }, baseUrl);
      return text;
    } catch (err) {
      if (text === '') return '';
      const cut = text.lastIndexOf(' ');
      text = (cut > 0 ? text.slice(0, cut) : text.slice(0, -1)).trim();
    }
  }
}

/**
 * @param {string} fragment "a=1.…", with or without the leading '#'
 * @param {number} now
 * @returns {{ok:true, alert: AlertPayload & {id:string, expiresAt:number}}
 *   | {ok:false, reason:'invalid'|'expired', expiresAt?:number}}
 */
export function decodeAlert(fragment, now) {
  const bad = /** @type {{ok:false, reason:'invalid'}} */ ({ ok: false, reason: 'invalid' });
  const m = FRAGMENT_RE.exec(String(fragment ?? '').replace(/^#/, ''));
  if (!m || checkChar(m[1]) !== m[2]) return bad;
  let arr;
  try {
    arr = JSON.parse(base64UrlToText(m[1]));
  } catch (err) {
    return bad;
  }
  if (!Array.isArray(arr) || arr.length !== 6) return bad;
  const [type, latE5, lonE5, createdMin, ttlMin, rawText] = arr;
  if (![type, latE5, lonE5, createdMin, ttlMin].every(Number.isInteger) || typeof rawText !== 'string') return bad;
  if (type < 1 || type > 6 || Math.abs(latE5) > 9000000 || Math.abs(lonE5) > 18000000) return bad;
  if (ttlMin < 1 || ttlMin > 1440 || createdMin <= 0 || createdMin * 60000 > now + 600000) return bad;
  let text = cleanText(rawText);
  if (text.length > LIMITS.alertText) return bad;
  if (hasEnforcementWord(text)) text = '';
  const createdAt = createdMin * 60000;
  const expiresAt = (createdMin + ttlMin) * 60000;
  if (expiresAt < now) return { ok: false, reason: 'expired', expiresAt };
  const alert = { type, lat: latE5 / 1e5, lon: lonE5 / 1e5, createdAt, ttlMin, text };
  return { ok: true, alert: { ...alert, id: alertId(alert), expiresAt } };
}

/** Finds the fragment inside pasted text (a whole message is fine). @returns {string|null} */
export function extractAlertFragment(text) {
  const m = /(?:^|[#\s])(a=\d+\.[A-Za-z0-9_-]{9,246})/.exec(String(text ?? ''));
  return m ? m[1] : null;
}
