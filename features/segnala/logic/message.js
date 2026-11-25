// @ts-check
// The 3-line message (SPEC 7.3), expiry choices (SPEC 6.7) and the `alerts` record validator.
import { cleanText, hasEnforcementWord, isLat, isLon } from '../../../core/pure/validators.js';
import { LIMITS } from '../../../core/pure/catalog.js';

/** Expiry chips: minutes, or 'tonight' (23:59 today). */
export const EXPIRY_CHOICES = /** @type {const} */ ([30, 60, 120, 240, 'tonight']);
export const KEEP_AFTER_EXPIRY_MS = 86400000;

/** Minutes from `from` to 23:59 local of the day of `now`, at least 1, at most 1440. */
export function ttlUntilTonight(from, now = from) {
  const d = new Date(now);
  d.setHours(23, 59, 0, 0);
  return Math.min(1440, Math.max(1, Math.round((d.getTime() - from) / 60000)));
}

/** @param {number|'tonight'} choice @param {number} createdAt @param {number} now @returns {number} minutes */
export function ttlFor(choice, createdAt, now) {
  // The link counts from the creation minute: a choice made later still means "from now".
  if (choice === 'tonight') return ttlUntilTonight(createdAt, now);
  return Math.min(1440, Math.max(1, Math.round((now - createdAt) / 60000) + choice));
}

/**
 * @param {{typeLabel:string, from:string, to:string, text:string, url:string}} p already formatted parts
 * @param {(key:string, vars?:object)=>string} t
 * @returns {string} three lines, one link (two when there is no detail)
 */
export function buildMessage(p, t) {
  const lines = [t('segnala.msg.line1', { type: p.typeLabel, from: p.from, to: p.to })];
  if (p.text) lines.push(p.text);
  lines.push(t('segnala.msg.link', { url: p.url }));
  return lines.join('\n');
}

/** `alerts` store record (SPEC 7.1). @returns {object|null} */
export function validateAlert(rec) {
  if (rec === null || typeof rec !== 'object' || typeof rec.id !== 'string' || rec.id === '') return null;
  if (!Number.isInteger(rec.type) || rec.type < 1 || rec.type > 6 || !isLat(rec.lat) || !isLon(rec.lon)) return null;
  if (!(rec.createdAt > 0) || !(rec.expiresAt > rec.createdAt)) return null;
  const text = cleanText(rec.text);
  return {
    id: rec.id, type: rec.type, lat: rec.lat, lon: rec.lon, createdAt: rec.createdAt, expiresAt: rec.expiresAt,
    text: text.length > LIMITS.alertText || hasEnforcementWord(text) ? '' : text,
    origin: rec.origin === 'received' ? 'received' : 'mine', fired: rec.fired === true,
  };
}
