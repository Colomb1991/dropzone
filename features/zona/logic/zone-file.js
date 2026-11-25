// @ts-check
// Zone file (SPEC 7.4): build, parse, plan the merge, turn the plan into records.
import { validateNoteInput, cleanText, isJpeg } from '../../../core/pure/validators.js';
import { bytesToBase64, base64ToBytes } from '../../../core/pure/base64.js';
import { distM } from '../../../core/pure/geo-math.js';
import { LIMITS } from '../../../core/pure/catalog.js';

export const ZONE_FORMAT = 'dropzone-zone';
export const ZONE_VERSION = 1;
export const ZONE_LIMITS = {
  notes: LIMITS.zoneNotes, bytes: LIMITS.zoneBytes, photoBytes: LIMITS.notePhotoBytes, name: LIMITS.zoneName,
};
export const DUPLICATE_M = 15;
export const UNDO_MS = 86400000;

/** @typedef {import('../../../core/types.js').Note} Note */
/** @typedef {{id:string, lat:number, lon:number, cat:string, text:string, biz:boolean, schedule:any,
 *   updatedAt:number, visits:{day:number, min:number, open:boolean, ym:string, mine:boolean}[],
 *   photo:{mime:'image/jpeg', w:number, h:number, bytes:ArrayBuffer}|null}} ZoneNote */

const pad = (n) => String(n).padStart(2, '0');

/** "Centro nord!" → "centro-nord" */
export function slug(name) {
  const s = String(name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'zona';
}

/** Trimmed, control characters removed, 40 characters. */
export function cleanZoneName(name) {
  return cleanText(name).slice(0, ZONE_LIMITS.name).trim();
}

/** Notes that may leave the phone: never the "Solo per me" ones. @param {Note[]} notes */
export function exportable(notes) {
  return notes.filter((n) => !n.private);
}

/**
 * @param {{name:string, exportedAt:number, notes:Note[],
 *   photos:Record<string, {mime:string, bytes:ArrayBuffer, w:number, h:number}>|null}} input
 * @returns {{filename:string, text:string, count:number}}
 */
export function buildZoneFile(input) {
  const name = cleanZoneName(input.name) || 'Zona';
  const d = new Date(input.exportedAt);
  const notes = exportable(input.notes).slice(0, ZONE_LIMITS.notes).map((n) => {
    /** @type {Record<string, any>} */
    const out = {
      id: n.id, lat: n.lat, lon: n.lon, cat: n.cat, text: n.text, biz: n.biz === true,
      schedule: n.schedule ?? null, updatedAt: new Date(n.updatedAt).toISOString(),
      visits: (n.visits ?? []).map((v) => ({ day: v.day, min: v.min, open: v.open, ym: v.ym })),
    };
    const photo = input.photos && n.photoId ? input.photos[n.photoId] : null;
    if (photo) out.photo = { mime: 'image/jpeg', w: photo.w, h: photo.h, b64: bytesToBase64(photo.bytes) };
    return out;
  });
  const file = {
    format: ZONE_FORMAT, version: ZONE_VERSION, name,
    exportedAt: `${d.toISOString().slice(0, 19)}Z`, notes,
  };
  return {
    filename: `zona-${slug(name)}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.txt`,
    text: JSON.stringify(file),
    count: notes.length,
  };
}

function parsePhoto(p) {
  if (p === undefined || p === null) return { ok: true, photo: null };
  if (typeof p !== 'object' || typeof p.b64 !== 'string') return { ok: false };
  if (p.b64.length > ZONE_LIMITS.photoBytes * 1.4) return { ok: false };
  let bytes;
  try {
    bytes = base64ToBytes(p.b64);
  } catch (err) {
    return { ok: false };
  }
  if (bytes.length > ZONE_LIMITS.photoBytes || !isJpeg(bytes)) return { ok: false };
  const side = (v) => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
  return { ok: true, photo: { mime: /** @type {'image/jpeg'} */ ('image/jpeg'), w: side(p.w), h: side(p.h),
    bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } };
}

/**
 * @param {string} text
 * @returns {{ok:true, zone:{name:string, exportedAt:number, notes:ZoneNote[]},
 *   rejected:{index:number, reason:string}[]} | {ok:false, reason:'not-zone'|'too-new'|'too-big'}}
 */
export function parseZoneFile(text) {
  if (typeof text !== 'string') return { ok: false, reason: 'not-zone' };
  if (text.length > ZONE_LIMITS.bytes) return { ok: false, reason: 'too-big' };
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (err) {
    return { ok: false, reason: 'not-zone' };
  }
  if (obj === null || typeof obj !== 'object' || obj.format !== ZONE_FORMAT || !Array.isArray(obj.notes)) {
    return { ok: false, reason: 'not-zone' };
  }
  if (!Number.isInteger(obj.version) || obj.version < 1) return { ok: false, reason: 'not-zone' };
  if (obj.version > ZONE_VERSION) return { ok: false, reason: 'too-new' };
  if (obj.notes.length > ZONE_LIMITS.notes) return { ok: false, reason: 'too-big' };
  const exportedAt = Date.parse(obj.exportedAt);
  /** @type {ZoneNote[]} */
  const notes = [];
  const rejected = [];
  const seen = new Set();
  obj.notes.forEach((raw, index) => {
    const reject = (reason) => rejected.push({ index, reason });
    if (raw === null || typeof raw !== 'object' || typeof raw.id !== 'string' || raw.id === '' || raw.id.length > 80) {
      return reject('id');
    }
    if (seen.has(raw.id)) return reject('id');
    const input = validateNoteInput(raw);
    if (!input.ok) return reject(input.reason);
    const updatedAt = Date.parse(raw.updatedAt);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) return reject('date');
    const p = parsePhoto(raw.photo);
    if (!p.ok) return reject('photo');
    seen.add(raw.id);
    notes.push({
      id: raw.id, ...input.value, updatedAt,
      visits: input.value.visits.map((v) => ({ ...v, mine: false })), photo: p.photo ?? null,
    });
    return undefined;
  });
  return {
    ok: true,
    zone: { name: cleanZoneName(obj.name) || 'Zona', exportedAt: Number.isFinite(exportedAt) ? exportedAt : 0, notes },
    rejected,
  };
}

/**
 * SPEC 7.4 merge rules.
 * @param {{notes:ZoneNote[]}} zone @param {Note[]} local
 * @returns {{add:ZoneNote[], update:ZoneNote[], same:ZoneNote[], edited:ZoneNote[], duplicate:ZoneNote[]}}
 */
export function planZoneImport(zone, local) {
  const byId = new Map(local.map((n) => [n.id, n]));
  const plan = { add: [], update: [], same: [], edited: [], duplicate: [] };
  for (const zn of zone.notes) {
    const mine = byId.get(zn.id);
    if (mine) {
      if (mine.origin === 'received' && mine.localEditAt) plan.edited.push(zn);
      else if (mine.origin === 'received' && zn.updatedAt > mine.updatedAt) plan.update.push(zn);
      else plan.same.push(zn);
      continue;
    }
    const text = zn.text.trim();
    const twin = local.some((n) => n.cat === zn.cat && n.text.trim() === text
      && distM(n.lat, n.lon, zn.lat, zn.lon) <= DUPLICATE_M);
    if (twin) plan.duplicate.push(zn);
    else plan.add.push(zn);
  }
  return plan;
}

const stampKey = (v) => `${v.day}|${v.min}|${v.open}|${v.ym}`;

/** Own stamps stay; received stamps are replaced by the file's; exact duplicates skipped. */
export function mergeVisits(localVisits, fileVisits) {
  const own = (localVisits ?? []).filter((v) => v.mine);
  const seen = new Set();
  const received = [];
  for (const v of fileVisits ?? []) {
    const k = stampKey(v);
    if (seen.has(k)) continue;
    seen.add(k);
    received.push({ ...v, mine: false });
  }
  return [...received, ...own].slice(-LIMITS.visits);
}

/**
 * Turns a plan into database records.
 * @param {ReturnType<typeof planZoneImport>} plan @param {Note[]} local
 * @param {{importId:string, packName:string, now:number, newId:()=>string}} ctx
 * @returns {{add:Note[], update:Note[], media:object[], dropMedia:string[], addedIds:string[]}}
 */
export function materialize(plan, local, ctx) {
  const byId = new Map(local.map((n) => [n.id, n]));
  const media = [];
  const dropMedia = [];
  const photoOf = (zn) => {
    if (!zn.photo) return null;
    const id = ctx.newId();
    media.push({ id, kind: 'photo', mime: 'image/jpeg', bytes: zn.photo.bytes, w: zn.photo.w, h: zn.photo.h,
      createdAt: ctx.now });
    return id;
  };
  const add = plan.add.map((zn) => ({
    id: zn.id, lat: zn.lat, lon: zn.lon, acc: null, cat: zn.cat, text: zn.text, schedule: zn.schedule,
    photoId: photoOf(zn), private: false, biz: zn.biz, visits: mergeVisits([], zn.visits),
    origin: /** @type {'received'} */ ('received'), packName: ctx.packName, importId: ctx.importId,
    createdAt: ctx.now, updatedAt: Math.min(zn.updatedAt, ctx.now), localEditAt: null,
  }));
  const update = [];
  for (const zn of plan.update) {
    const cur = byId.get(zn.id);
    if (!cur) continue;
    if (cur.photoId) dropMedia.push(cur.photoId);
    update.push({
      ...cur, lat: zn.lat, lon: zn.lon, cat: zn.cat, text: zn.text, schedule: zn.schedule, biz: zn.biz,
      photoId: photoOf(zn), visits: mergeVisits(cur.visits, zn.visits),
      updatedAt: Math.min(zn.updatedAt, ctx.now),
    });
  }
  return { add, update, media, dropMedia, addedIds: add.map((n) => n.id) };
}

/** `imports` store record. @returns {object|null} */
export function validateImport(rec) {
  if (rec === null || typeof rec !== 'object' || typeof rec.id !== 'string' || rec.id === '') return null;
  if (!(rec.at > 0) || !Array.isArray(rec.addedIds)) return null;
  return {
    id: rec.id, at: rec.at, packName: typeof rec.packName === 'string' ? rec.packName : '',
    addedIds: rec.addedIds.filter((x) => typeof x === 'string'),
    updated: Number.isInteger(rec.updated) ? rec.updated : 0,
  };
}
