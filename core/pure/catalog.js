// @ts-check
// SPEC 6.3 (note categories), 6.7 (colleague alert types), 6.9 (limits).

/** @typedef {'danger'|'warning'|'info'|'access'|'success'|'neutral'} Tone */
/** @typedef {{id:string, tone:Tone, icon:string, cls:'approach'|'stop'|'none',
 *   output:'voice'|'sound'|'silent', voice:boolean, biz:boolean}} Category */

export const NOTE_CATS = /** @type {const} */ (
  ['ingresso', 'cane', 'parcheggio', 'orari', 'strada', 'consegna', 'negozio', 'bagno', 'altro']);

const cat = (id, tone, icon, cls, output, biz = false) =>
  ({ id, tone, icon, cls, output, voice: output === 'voice', biz });

/** @type {Record<string, Category>} */
export const CATEGORIES = {
  ingresso: cat('ingresso', 'access', 'door-closed', 'stop', 'sound'),
  cane: cat('cane', 'danger', 'dog', 'stop', 'voice'),
  parcheggio: cat('parcheggio', 'info', 'circle-parking', 'approach', 'sound'),
  orari: cat('orari', 'warning', 'clock', 'approach', 'voice'),
  strada: cat('strada', 'warning', 'triangle-alert', 'approach', 'voice'),
  consegna: cat('consegna', 'access', 'building-2', 'stop', 'sound'),
  negozio: cat('negozio', 'info', 'store', 'stop', 'sound', true),
  bagno: cat('bagno', 'success', 'coffee', 'none', 'silent'),
  altro: cat('altro', 'neutral', 'map-pin', 'stop', 'sound'),
};

/** @type {Record<number, {code:number, tone:Tone, icon:string, ttlMin:number}>} */
export const ALERT_TYPES = {
  1: { code: 1, tone: 'danger', icon: 'car', ttlMin: 60 },
  2: { code: 2, tone: 'danger', icon: 'ban', ttlMin: 240 },
  3: { code: 3, tone: 'danger', icon: 'waves', ttlMin: 120 },
  4: { code: 4, tone: 'warning', icon: 'ban', ttlMin: 120 },
  5: { code: 5, tone: 'warning', icon: 'store', ttlMin: 240 },
  6: { code: 6, tone: 'neutral', icon: 'megaphone', ttlMin: 60 },
};

export const ALERT_RADIUS_M = 300;
export const NEARBY_RADIUS_M = 150;
export const STOP_RADIUS_M = 60;

export const LIMITS = {
  notes: 3000, noteText: 280, spokenText: 90, visits: 60, alertText: 60, alertUrl: 300,
  zoneNotes: 1000, zoneBytes: 10485760, zoneName: 40, backupBytes: 104857600,
  notePhotoBytes: 614400, vanPhotos: 16, contactName: 20,
};

export function isNoteCat(id) {
  return Object.prototype.hasOwnProperty.call(CATEGORIES, id);
}

/** @returns {Category} unknown ids fall back to `altro` */
export function category(id) {
  return isNoteCat(id) ? CATEGORIES[id] : CATEGORIES.altro;
}

/** i18n key of the category name. */
export function catLabelKey(id) {
  return `core.cat.${category(id).id}`;
}

/** i18n key of the spoken one-word label, or null when the category is never spoken. */
export function catVoiceKey(id) {
  const c = category(id);
  return c.voice || c.id === 'parcheggio' ? `core.voice.${c.id}` : null;
}

export function alertType(code) {
  return ALERT_TYPES[code] ?? ALERT_TYPES[6];
}

export function alertTypeKey(code) {
  return `core.alertType.${alertType(code).code}`;
}

/** SPEC 6.6: cue by tone. @param {Tone} tone */
export function cueForTone(tone) {
  return tone === 'danger' ? 'alertDanger' : tone === 'warning' ? 'alertWarning' : 'alertInfo';
}

/** Text for the voice: cut at the last word within `max` characters. */
export function cutAtWord(text, max = LIMITS.spokenText) {
  const s = String(text ?? '').trim();
  if (s.length <= max) return s;
  const head = s.slice(0, max + 1);
  const i = head.lastIndexOf(' ');
  return (i > 0 ? head.slice(0, i) : s.slice(0, max)).trim();
}
