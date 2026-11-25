// @ts-check
// SPEC 7.5: JSON Lines. Line 1 = header, then {"s": store, "r": record}; binary as {"$b64": "..."}.
import { bytesToBase64, base64ToBytes } from './base64.js';

export const BACKUP_FORMAT = 'dropzone-backup';
export const BACKUP_VERSION = 1;

/** @param {{schema:number, appVersion:string, createdAt:number, includeVan?:boolean,
 *   counts?:Record<string, number>}} meta */
export function backupHeader(meta) {
  return {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, schema: meta.schema, appVersion: meta.appVersion,
    createdAt: new Date(meta.createdAt).toISOString(),
    includes: { vanMedia: meta.includeVan === true }, counts: meta.counts ?? {},
  };
}

/** @param {Date} date local time @returns {string} dropzone-backup-YYYYMMDD-HHmm.txt */
export function backupFilename(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${BACKUP_FORMAT}-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`
    + `-${p(date.getHours())}${p(date.getMinutes())}.txt`;
}

function enc(v) {
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
    const bytes = v instanceof ArrayBuffer ? new Uint8Array(v)
      : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    return { $b64: bytesToBase64(bytes) };
  }
  if (Array.isArray(v)) return v.map(enc);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k] = enc(v[k]);
    return out;
  }
  return v;
}

function dec(v) {
  if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === '$b64' && typeof v.$b64 === 'string') {
      const bytes = base64ToBytes(v.$b64);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
    const out = {};
    for (const k of keys) out[k] = dec(v[k]);
    return out;
  }
  return v;
}

export function encodeRecord(store, rec) {
  return enc(rec);
}

export function decodeRecord(store, raw) {
  return dec(raw);
}

/** @param {string} store @param {object} rec @returns {string} one line, no newline */
export function encodeLine(store, rec) {
  return JSON.stringify({ s: store, r: enc(rec) });
}

/** @param {string} line @returns {{s:string, r:object}|null} null for a blank or damaged line */
export function decodeLine(line) {
  const text = line.trim();
  if (text === '') return null;
  try {
    const obj = JSON.parse(text);
    if (!obj || typeof obj.s !== 'string' || !obj.r || typeof obj.r !== 'object') return null;
    return { s: obj.s, r: dec(obj.r) };
  } catch (err) {
    return null;
  }
}

/**
 * @param {unknown} obj parsed first line
 * @param {number} dbVersion
 * @returns {{ok:true, preview:{createdAt:number, appVersion:string, schema:number, vanMedia:boolean,
 *   counts:Record<string, number>}} | {ok:false, reason:'not-backup'|'too-new'}}
 */
export function validateHeader(obj, dbVersion) {
  const h = /** @type {any} */ (obj);
  if (!h || typeof h !== 'object' || h.format !== BACKUP_FORMAT || !Number.isInteger(h.version)
    || !Number.isInteger(h.schema) || h.schema < 1) return { ok: false, reason: 'not-backup' };
  if (h.version > BACKUP_VERSION || h.schema > dbVersion) return { ok: false, reason: 'too-new' };
  const createdAt = Date.parse(h.createdAt);
  const counts = {};
  if (h.counts && typeof h.counts === 'object') {
    for (const k of Object.keys(h.counts)) if (Number.isInteger(h.counts[k])) counts[k] = h.counts[k];
  }
  return {
    ok: true,
    preview: {
      createdAt: Number.isFinite(createdAt) ? createdAt : 0, appVersion: String(h.appVersion ?? ''),
      schema: h.schema, vanMedia: h.includes?.vanMedia === true, counts,
    },
  };
}

/**
 * Migrates a record from an older schema, then validates it with the store's own rule.
 * @param {{validate:(r:unknown)=>object|null, upgrades?:Record<number,(r:object)=>object|null>}} def
 * @returns {object|null}
 */
export function upgradeRecord(def, rec, fromSchema, toSchema) {
  let cur = rec;
  for (let v = fromSchema + 1; v <= toSchema && cur; v++) {
    const up = def.upgrades?.[v];
    if (up) cur = up(cur);
  }
  return cur ? def.validate(cur) : null;
}

/**
 * Media ids a record cannot live without (StoreDef.mediaRefs; the van diary names its photos).
 * @param {{mediaRefs?:(r:any)=>unknown}} def @param {object} rec @returns {string[]}
 */
export function mediaRefsOf(def, rec) {
  if (typeof def?.mediaRefs !== 'function') return [];
  try {
    const ids = def.mediaRefs(rec);
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && id !== '') : [];
  } catch (err) {
    return [];
  }
}

/**
 * Export only what can be restored whole: a record that points at media the file leaves out
 * (van photos, when the courier did not include them) is left out with them.
 * @param {{mediaRefs?:(r:any)=>unknown}} def @param {object} rec @param {{has(id:string):boolean}} leftOut
 */
export function exportsWhole(def, rec, leftOut) {
  return !mediaRefsOf(def, rec).some((id) => leftOut.has(id));
}

/**
 * Restore only what arrives whole: every media a record needs is in the file or already on the
 * phone. Guards files made before the export rule above existed.
 * @param {{mediaRefs?:(r:any)=>unknown}} def @param {object} rec @param {(id:string)=>boolean} hasMedia
 */
export function restoresWhole(def, rec, hasMedia) {
  return mediaRefsOf(def, rec).every((id) => hasMedia(id));
}

/**
 * Merge rule (SPEC 4.8): missing → add; settings → local wins; `updatedAt` on both → newer wins;
 * otherwise keep local.
 * @returns {'add'|'update'|'skip'}
 */
export function mergeDecision(store, incoming, local) {
  if (local === undefined || local === null) return 'add';
  if (store === 'settings') return 'skip';
  const a = /** @type {any} */ (incoming).updatedAt;
  const b = /** @type {any} */ (local).updatedAt;
  return typeof a === 'number' && typeof b === 'number' && a > b ? 'update' : 'skip';
}
