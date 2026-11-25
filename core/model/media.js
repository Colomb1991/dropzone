// @ts-check
// Media records are {mime, bytes: ArrayBuffer}, never Blob.
import * as db from '../db/db.js';
import { now } from '../clock.js';

/** @typedef {import('../types.js').Media} Media */

/** @returns {Promise<Media|undefined>} */
export function getMedia(id) {
  return db.get('media', id);
}

/** blob: URL; the caller must revoke. @returns {Promise<{url:string, revoke:()=>void}|null>} */
export async function mediaUrl(id) {
  const m = id ? await getMedia(id) : undefined;
  if (!m) return null;
  const url = URL.createObjectURL(new Blob([m.bytes], { type: m.mime }));
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

/** @param {Omit<Media,'id'|'createdAt'>} m @returns {Promise<string>} id */
export async function putMedia(m) {
  const id = crypto.randomUUID();
  await db.put('media', { id, kind: m.kind, mime: m.mime, bytes: m.bytes, w: m.w ?? 0, h: m.h ?? 0,
    createdAt: now() });
  return id;
}

export async function deleteMedia(id) {
  await db.del('media', id);
}

/** @param {'photo'|'van'} [kind] @returns {Promise<{count:number, bytes:number}>} */
export async function mediaUsage(kind) {
  /** @type {Media[]} */
  const all = await db.getAll('media', kind ? { index: 'kind', eq: kind } : undefined);
  return { count: all.length, bytes: all.reduce((sum, m) => sum + (m.bytes?.byteLength ?? 0), 0) };
}
