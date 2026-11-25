// @ts-check
// The only builder of outbound link URLs. Links are rendered as real <a target="_blank"
// rel="noopener noreferrer">; the app never requests these hosts itself.
import { os } from '../env.js';

const c5 = (v) => Number(v).toFixed(5);

/** @param {'google'|'waze'|'apple'} app @param {{walk?:boolean}} [opts] */
export function navUrl(app, lat, lon, opts = {}) {
  const ll = `${c5(lat)}%2C${c5(lon)}`;
  if (app === 'waze') return `https://waze.com/ul?ll=${ll}&navigate=yes`;
  if (app === 'apple') return `https://maps.apple.com/?daddr=${ll}&dirflg=${opts.walk ? 'w' : 'd'}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=${opts.walk ? 'walking' : 'driving'}`;
}

export function mapPointUrl(lat, lon) {
  return `https://www.google.com/maps/search/?api=1&query=${c5(lat)}%2C${c5(lon)}`;
}

/** @param {string} text @param {string} [number] E.164 */
export function whatsappUrl(text, number) {
  const digits = number ? number.replace(/\D/g, '') : '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** UNVERIFIED on both platforms: `sms:<E.164>?&body=…`. */
export function smsUrl(number, text) {
  return `sms:${number}?&body=${encodeURIComponent(text)}`;
}

export function telUrl(number) {
  return `tel:${String(number).replace(/[^\d+]/g, '')}`;
}

/** @returns {('google'|'waze'|'apple')[]} 'apple' only on iOS */
export function navApps() {
  return os() === 'ios' ? ['google', 'waze', 'apple'] : ['google', 'waze'];
}
