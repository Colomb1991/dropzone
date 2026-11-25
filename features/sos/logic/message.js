// @ts-check
// SOS message parts (SPEC 4.10). Pure: the screen supplies the translated templates and the links.

/** @typedef {{lat:number, lon:number, acc:number, ts:number}} FixLike */

const MAX_AGE_MS = 30 * 60000;

/** "45.46420, 9.19000" */
export function coords5(lat, lon) {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/**
 * The fix worth sending: newer wins after 30 s, otherwise the more accurate one.
 * @param {FixLike|null} cur @param {FixLike|null} next @returns {FixLike|null}
 */
export function betterFix(cur, next) {
  if (!next) return cur;
  if (!cur) return next;
  if (next.ts - cur.ts > 30000) return next;
  if (cur.ts - next.ts > 30000) return cur;
  return next.acc <= cur.acc ? next : cur;
}

/** A position older than 30 minutes is not sent as "sono qui". */
export function usableFix(fix, now) {
  return fix && now - fix.ts <= MAX_AGE_MS ? fix : null;
}

/**
 * @param {FixLike|null} fix
 * @param {{withFix:string, noFix:string, time:(ts:number)=>string, mapUrl:(lat:number, lon:number)=>string}} p
 *   `withFix` holds {coords}, {time}, {acc} and {url}
 * @returns {string}
 */
export function sosMessage(fix, p) {
  if (!fix) return p.noFix;
  const values = { coords: coords5(fix.lat, fix.lon), time: p.time(fix.ts), acc: String(Math.round(fix.acc)),
    url: p.mapUrl(fix.lat, fix.lon) };
  return p.withFix.replace(/\{(\w+)\}/g, (all, k) => (k in values ? values[k] : all));
}

/**
 * Real link for the trusted contact, or null without one.
 * @param {{number:string, channel:'whatsapp'|'sms'}|null} contact @param {string} text
 * @param {{whatsappUrl:(text:string, number?:string)=>string, smsUrl:(number:string, text:string)=>string}} links
 */
export function contactLink(contact, text, links) {
  if (!contact) return null;
  return contact.channel === 'sms' ? links.smsUrl(contact.number, text) : links.whatsappUrl(text, contact.number);
}
