// @ts-check
// Zone export and import against the database: build the file, apply a plan, undo within 24 h.
import { db, notes, media, clock, share, log } from '../../core/api.js';
import {
  buildZoneFile, parseZoneFile, planZoneImport, materialize, exportable, ZONE_LIMITS, UNDO_MS,
} from './logic/zone-file.js';

/** Notes that can be exported, newest first. */
export async function listExportable() {
  return exportable(await notes.listNotes());
}

/** Bytes of the photos of the given notes. */
export async function photoBytes(list) {
  let bytes = 0;
  for (const n of list) {
    if (!n.photoId) continue;
    const m = await media.getMedia(n.photoId);
    bytes += m?.bytes?.byteLength ?? 0;
  }
  return bytes;
}

/**
 * Prepare, then tap: the File exists before the send button is enabled.
 * @returns {Promise<{file:File, count:number, bytes:number}>}
 */
export async function prepareZoneFile({ name, list, includePhotos }) {
  /** @type {Record<string, any>|null} */
  let photos = null;
  if (includePhotos) {
    photos = {};
    for (const n of list) {
      const m = n.photoId ? await media.getMedia(n.photoId) : null;
      if (m) photos[n.photoId] = m;
    }
  }
  const built = buildZoneFile({ name, exportedAt: clock.now(), notes: list, photos });
  const file = share.makeFile(built.filename, 'text/plain', [built.text]);
  return { file, count: built.count, bytes: file.size };
}

/**
 * Reads a picked file and plans the merge. Nothing is written.
 * @param {File} file
 */
export async function previewZoneFile(file) {
  if (file.size > ZONE_LIMITS.bytes) return { ok: false, reason: 'too-big' };
  const parsed = parseZoneFile(await file.text());
  if (!parsed.ok) return parsed;
  const local = await notes.listNotes();
  return { ok: true, zone: parsed.zone, rejected: parsed.rejected, plan: planZoneImport(parsed.zone, local) };
}

/** Applies a preview. @returns {Promise<{id:string, count:number}>} */
export async function applyZoneImport(preview) {
  const local = await notes.listNotes();
  // Planned again on fresh data: the list may have changed while the preview was open.
  const plan = planZoneImport(preview.zone, local);
  const at = clock.now();
  const id = crypto.randomUUID();
  const recs = materialize(plan, local, { importId: id, packName: preview.zone.name, now: at,
    newId: () => crypto.randomUUID() });
  await notes.applyNoteBatch({ add: recs.add, update: recs.update, media: recs.media });
  for (const mediaId of recs.dropMedia) await media.deleteMedia(mediaId).catch((err) => log.error('zona', err));
  await db.put('imports', { id, at, packName: preview.zone.name, addedIds: recs.addedIds, updated: recs.update.length });
  return { id, count: recs.add.length + recs.update.length };
}

/** The newest import that can still be undone. */
export async function lastImport(now = clock.now()) {
  const all = await db.getAll('imports');
  for (const rec of all) if (now - rec.at >= UNDO_MS) await db.del('imports', rec.id);
  const live = all.filter((r) => now - r.at < UNDO_MS).sort((a, b) => b.at - a.at);
  return live[0] ?? null;
}

/** Removes the notes added by that import; updates stay. @returns {Promise<number>} removed */
export async function undoImport(id) {
  const rec = await db.get('imports', id);
  if (!rec) return 0;
  await notes.applyNoteBatch({ remove: rec.addedIds });
  await db.del('imports', id);
  return rec.addedIds.length;
}
