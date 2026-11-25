// @ts-check
// Diario furgone: the deletes. A photo and its diary record always change in one transaction, so
// the counts on screen and "Spazio usato" never disagree with what is stored.
import { db, clock, AppError } from '../../../core/api.js';
import { validateVan, removePhoto } from './van.js';

/**
 * Deletes one photo of a session, guided or extra: the picture and its line in the diary record.
 * A session left with no photos and no checklist goes with it.
 * @param {string} sessionId @param {string} mediaId
 * @returns {Promise<'photo'|'session'|'missing'>} what went: the photo, the whole session, nothing
 */
export function deletePhoto(sessionId, mediaId) {
  return db.tx(['media', 'van'], 'rw', async (tx) => {
    const latest = validateVan(await tx.get('van', sessionId));
    const res = latest ? removePhoto(latest, mediaId, clock.now()) : null;
    if (!res || !res.removed) return 'missing';
    await tx.del('media', mediaId);
    if (res.session === null) {
      await tx.del('van', sessionId);
      return 'session';
    }
    const next = validateVan(res.session);
    if (!next) throw new AppError('van-invalid', 'core.err.save');
    await tx.put('van', next);
    return 'photo';
  });
}

/**
 * Deletes a whole session: every photo it holds, then the record. No diary record is left
 * pointing at deleted photos, no photo is left without its record.
 * @param {import('./van.js').VanSession} session the session as shown; what is stored now wins
 */
export function deleteSession(session) {
  return db.tx(['media', 'van'], 'rw', async (tx) => {
    const latest = validateVan(await tx.get('van', session.id));
    const ids = new Set([...session.photos, ...(latest?.photos ?? [])].map((p) => p.mediaId));
    for (const id of ids) await tx.del('media', id);
    await tx.del('van', session.id);
  });
}
