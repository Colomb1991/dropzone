// @ts-check
// Choices of SPEC 4.12 and small pure helpers of the settings screens.
import { normalizePhone } from '../../../core/pure/validators.js';
import { LIMITS } from '../../../core/pure/catalog.js';

export const THEMES = ['auto', 'light', 'dark', 'hc'];
export const RADII = [40, 80, 150, 250];
export const RATES = [['slow', 0.85], ['normal', 1], ['fast', 1.2]];
export const LEVELS = ['off', 'normal', 'loud'];
export const MODES = ['holder', 'pocket'];
export const BREAKS = [15, 30, 45, 60];
export const DAYS = [5, 6];
export const HOURS = { min: 20, max: 48, step: 0.5, first: 40 };
export const CHANNELS = ['whatsapp', 'sms'];
/** Stores shown in the backup preview, in this order. */
export const BACKUP_STORES = ['notes', 'shifts', 'media', 'alerts', 'van', 'settings'];

/** Next value of "Ore a settimana": the first press sets 40, later ones move by half an hour. */
export function nextHours(current, proposed) {
  if (current === null || current === undefined) return HOURS.first;
  return Math.min(HOURS.max, Math.max(HOURS.min, Math.round(proposed * 2) / 2));
}

/**
 * The trusted contact as it would be saved, or null while the form is incomplete.
 * @returns {{name:string, number:string, channel:'whatsapp'|'sms'}|null}
 */
export function contactFromForm(name, numberInput, channel) {
  const clean = String(name ?? '').trim().slice(0, LIMITS.contactName);
  const number = normalizePhone(String(numberInput ?? ''));
  if (!clean || !number) return null;
  return { name: clean, number, channel: channel === 'sms' ? 'sms' : 'whatsapp' };
}

/** Whole days between two instants, never negative. */
export function daysBetween(from, to) {
  return Math.max(0, Math.floor((to - from) / 86400000));
}

/** Bytes of the van photos, read from the diary records (no photo is loaded). */
export function vanBytes(records) {
  let sum = 0;
  for (const rec of records ?? []) {
    for (const p of rec?.photos ?? []) sum += Number.isFinite(p?.bytes) ? p.bytes : 0;
  }
  return sum;
}

/** Rows of the backup preview: known stores with a count above zero. @returns {[string, number][]} */
export function previewRows(counts) {
  return BACKUP_STORES.filter((s) => Number(counts?.[s]) > 0).map((s) => [s, counts[s]]);
}
