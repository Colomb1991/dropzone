// @ts-check
// Record validators shared by the repositories, zone import and backup restore.
import { round } from './geo-math.js';
import { validateSchedule } from './schedule.js';
import { isNoteCat, LIMITS } from './catalog.js';

const ENFORCEMENT_RE = new RegExp('\\b(polizi\\w*|carabinier\\w*|vigil[ei](?! del fuoco)|guardia di finanza'
  + '|pattugli\\w*|posto di (blocco|controllo)|auto ?velox|velox|telelaser|tutor|etilometr\\w*'
  + '|alcol ?test|police|cops?|speed ?(trap|camera|check))\\b', 'i');
// C0/C1 controls, zero-width and bidi marks.
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g;

/** True when the text names police or speed checks (SPEC 6.7, legal notice 26). */
export function hasEnforcementWord(text) {
  return typeof text === 'string' && ENFORCEMENT_RE.test(text);
}

/** Removes control characters and trims. */
export function cleanText(text) {
  return String(text ?? '').replace(CONTROL_RE, ' ').replace(/ {2,}/g, ' ').trim();
}

/**
 * E.164 with 8–15 digits, or null. National numbers get `+cc` (Italian numbers keep their leading 0).
 * @param {string} input @param {string} [cc] @returns {string|null}
 */
export function normalizePhone(input, cc = '39') {
  if (typeof input !== 'string') return null;
  let s = input.replace(/[\s\-().\/]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  if (!s.startsWith('+')) s = `+${cc}${s}`;
  const digits = s.slice(1);
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return `+${digits}`;
}

export const isLat = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 90;
export const isLon = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 180;
const isTs = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const tsOrNull = (v) => (isTs(v) ? v : null);
const strOrNull = (v) => (typeof v === 'string' && v !== '' ? v : null);
const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 80;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** @returns {import('./visits.js').Visit[]|null} null = invalid */
export function validateVisits(list) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const v of list) {
    if (!isObj(v) || !Number.isInteger(v.day) || v.day < 1 || v.day > 7) return null;
    if (!Number.isInteger(v.min) || v.min < 0 || v.min > 1439) return null;
    if (typeof v.open !== 'boolean' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v.ym)) return null;
    out.push({ day: v.day, min: v.min, open: v.open, ym: v.ym, mine: v.mine === true });
  }
  return out.slice(-LIMITS.visits);
}

/**
 * The fields a user or a file may set on a note. Used by the editor and the zone import.
 * @returns {{ok:true, value:{lat:number, lon:number, cat:string, text:string, schedule:any, biz:boolean,
 *   visits:any[]}} | {ok:false, reason:'cat'|'position'|'text-long'|'words'|'schedule'|'visits'}}
 */
export function validateNoteInput(raw) {
  if (!isObj(raw) || !isNoteCat(raw.cat)) return { ok: false, reason: 'cat' };
  if (!isLat(raw.lat) || !isLon(raw.lon)) return { ok: false, reason: 'position' };
  const text = cleanText(raw.text);
  if (text.length > LIMITS.noteText) return { ok: false, reason: 'text-long' };
  if (hasEnforcementWord(text)) return { ok: false, reason: 'words' };
  const schedule = validateSchedule(raw.schedule);
  if (schedule === undefined) return { ok: false, reason: 'schedule' };
  const visits = validateVisits(raw.visits);
  if (!visits) return { ok: false, reason: 'visits' };
  const biz = typeof raw.biz === 'boolean' ? raw.biz : raw.cat === 'negozio';
  return { ok: true, value: { lat: round(raw.lat, 6), lon: round(raw.lon, 6), cat: raw.cat, text, schedule, biz, visits } };
}

/** Full `notes` record (SPEC 7.1). @returns {import('../types.js').Note|null} */
export function validateNote(rec) {
  if (!isObj(rec) || !isId(rec.id) || !isTs(rec.createdAt)) return null;
  const input = validateNoteInput(rec);
  if (!input.ok) return null;
  return {
    id: rec.id, ...input.value,
    acc: typeof rec.acc === 'number' && Number.isFinite(rec.acc) ? rec.acc : null,
    photoId: strOrNull(rec.photoId),
    private: rec.private === true,
    origin: rec.origin === 'received' ? 'received' : 'mine',
    packName: strOrNull(rec.packName), importId: strOrNull(rec.importId),
    createdAt: rec.createdAt, updatedAt: isTs(rec.updatedAt) ? rec.updatedAt : rec.createdAt,
    localEditAt: tsOrNull(rec.localEditAt),
  };
}

export function validateNoteState(rec) {
  if (!isObj(rec) || !isId(rec.noteId)) return null;
  return { noteId: rec.noteId, lastFiredAt: tsOrNull(rec.lastFiredAt), mutedUntil: tsOrNull(rec.mutedUntil) };
}

/** JPEG by magic bytes FF D8 FF. @param {ArrayBuffer|Uint8Array} bytes */
export function isJpeg(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}

export function validateMedia(rec) {
  if (!isObj(rec) || !isId(rec.id) || (rec.kind !== 'photo' && rec.kind !== 'van')) return null;
  const bytes = rec.bytes instanceof Uint8Array
    ? rec.bytes.buffer.slice(rec.bytes.byteOffset, rec.bytes.byteOffset + rec.bytes.byteLength) : rec.bytes;
  if (!(bytes instanceof ArrayBuffer) || bytes.byteLength === 0 || !isJpeg(bytes)) return null;
  return {
    id: rec.id, kind: rec.kind, mime: 'image/jpeg', bytes,
    w: Number.isFinite(rec.w) ? rec.w : 0, h: Number.isFinite(rec.h) ? rec.h : 0,
    createdAt: isTs(rec.createdAt) ? rec.createdAt : 0,
  };
}

/** `shifts` record. @returns {import('../types.js').Shift|null} */
export function validateShift(rec) {
  if (!isObj(rec) || !isId(rec.id) || !isTs(rec.startAt)) return null;
  const endAt = tsOrNull(rec.endAt);
  if (endAt !== null && endAt < rec.startAt) return null;
  const breaks = [];
  for (const b of Array.isArray(rec.breaks) ? rec.breaks : []) {
    if (!isObj(b) || !isTs(b.startAt)) return null;
    const bEnd = tsOrNull(b.endAt);
    if (bEnd !== null && bEnd < b.startAt) return null;
    const br = { startAt: b.startAt, endAt: bEnd, plannedMin: Number.isFinite(b.plannedMin) ? b.plannedMin : 30 };
    breaks.push(b.auto === true ? { ...br, auto: true } : br);
  }
  const shift = {
    id: rec.id, startAt: rec.startAt, endAt, mode: rec.mode === 'pocket' ? 'pocket' : 'holder', breaks,
    edited: rec.edited === true,
    alertsFired: Number.isInteger(rec.alertsFired) && rec.alertsFired > 0 ? rec.alertsFired : 0,
    lastSeenAt: isTs(rec.lastSeenAt) ? rec.lastSeenAt : rec.startAt,
  };
  // Added by hand in "Ore" (a day marked as worked): the mark is kept, records without it stay as they are.
  return rec.manual === true ? { ...shift, manual: true } : shift;
}

export function validateSettingRecord(rec) {
  if (!isObj(rec) || typeof rec.key !== 'string' || rec.key === '' || !('value' in rec)) return null;
  return { key: rec.key, value: rec.value, updatedAt: isTs(rec.updatedAt) ? rec.updatedAt : 0 };
}

export function validateKv(rec) {
  return isObj(rec) && typeof rec.key === 'string' && rec.key !== '' ? rec : null;
}

/** SOS contact (settings key `sos.contact`). */
export function validateContact(v) {
  if (v === null) return true;
  return isObj(v) && typeof v.name === 'string' && v.name.length <= LIMITS.contactName
    && typeof v.number === 'string' && normalizePhone(v.number) === v.number
    && (v.channel === 'whatsapp' || v.channel === 'sms');
}
