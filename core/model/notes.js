// @ts-check
// Repository of `notes` and `noteState`. Features never call db.put('notes', …) directly.
import * as db from '../db/db.js';
import { now } from '../clock.js';
import { AppError } from '../errors.js';
import { validateNote, cleanText, hasEnforcementWord } from '../pure/validators.js';
import { LIMITS, isNoteCat } from '../pure/catalog.js';
import { visitStamp, addStamp, removeLastOwn } from '../pure/visits.js';
import { round } from '../pure/geo-math.js';

/** @typedef {import('../types.js').Note} Note */
const EDITABLE = ['lat', 'lon', 'acc', 'cat', 'text', 'schedule', 'private', 'biz'];

function checked(rec) {
  if (hasEnforcementWord(rec.text)) throw new AppError('note-words', 'core.err.words');
  if (cleanText(rec.text).length > LIMITS.noteText) throw new AppError('note-long', 'core.err.noteLong');
  const note = validateNote(rec);
  if (!note) throw new AppError('note-invalid', 'core.err.generic');
  return note;
}

/** @param {{cat?:string, incomplete?:boolean, origin?:'mine'|'received'}} [filter] newest first */
export async function listNotes(filter = {}) {
  /** @type {Note[]} */
  const all = await db.getAll('notes', filter.cat ? { index: 'cat', eq: filter.cat } : undefined);
  return all.filter((n) => (!filter.origin || n.origin === filter.origin)
    && (filter.incomplete === undefined || isIncomplete(n) === filter.incomplete))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** @returns {Promise<Note|undefined>} */
export function getNote(id) {
  return db.get('notes', id);
}

export function countNotes() {
  return db.count('notes');
}

/**
 * @param {{lat:number, lon:number, acc:number|null, cat:string, at:number, text?:string, here?:boolean}} input
 *   `here`: saved where the courier stands. The note counts as already announced (`lastFiredAt` = now,
 *   same transaction), so the shift in progress does not sound its alert a few seconds after the save.
 * @returns {Promise<Note>} throws AppError('notes-limit') at 3,000
 */
export async function createNote(input) {
  if (!isNoteCat(input.cat)) throw new AppError('note-invalid', 'core.err.generic');
  const note = checked({
    id: crypto.randomUUID(), lat: round(input.lat, 6), lon: round(input.lon, 6), acc: input.acc ?? null,
    cat: input.cat, text: input.text ?? '', schedule: null, photoId: null, private: false,
    biz: input.cat === 'negozio', visits: [], origin: 'mine', packName: null, importId: null,
    createdAt: input.at, updatedAt: input.at, localEditAt: null,
  });
  return db.tx(input.here ? ['notes', 'noteState'] : ['notes'], 'rw', async (t) => {
    if (await t.count('notes') >= LIMITS.notes) throw new AppError('notes-limit', 'core.err.notesLimit');
    await t.put('notes', note);
    if (input.here) await t.put('noteState', { noteId: note.id, lastFiredAt: input.at, mutedUntil: null });
    return note;
  });
}

async function modify(id, fn) {
  return db.tx(['notes'], 'rw', async (t) => {
    const cur = await t.get('notes', id);
    if (!cur) throw new AppError('note-missing', 'core.err.generic');
    const next = checked(fn(cur));
    await t.put('notes', next);
    return next;
  });
}

/** Validates, sets updatedAt and localEditAt. @param {Partial<Note>} patch @returns {Promise<Note>} */
export function updateNote(id, patch) {
  return modify(id, (cur) => {
    const next = { ...cur };
    for (const k of EDITABLE) if (k in patch) next[k] = patch[k];
    const at = now();
    return { ...next, updatedAt: at, localEditAt: at };
  });
}

/** Removes note, photo and state in one transaction. */
export async function deleteNote(id) {
  const saved = await db.tx(['notes', 'media', 'noteState'], 'rw', async (t) => {
    const note = await t.get('notes', id);
    if (!note) return null;
    const media = note.photoId ? await t.get('media', note.photoId) : null;
    const state = await t.get('noteState', id);
    await t.del('notes', id);
    if (note.photoId) await t.del('media', note.photoId);
    await t.del('noteState', id);
    return { note, media, state };
  });
  return {
    undo: async () => {
      if (!saved) return;
      await db.tx(['notes', 'media', 'noteState'], 'rw', async (t) => {
        await t.put('notes', saved.note);
        if (saved.media) await t.put('media', saved.media);
        if (saved.state) await t.put('noteState', saved.state);
      });
    },
  };
}

/**
 * Sets or removes the note photo (one per note).
 * @param {string} id @param {'photo'} kind
 * @param {{mime:string, bytes:ArrayBuffer, w?:number, h?:number}|null} media
 */
export async function setNoteMedia(id, kind, media) {
  if (kind !== 'photo') throw new AppError('media-kind', 'core.err.generic');
  await db.tx(['notes', 'media'], 'rw', async (t) => {
    const note = await t.get('notes', id);
    if (!note) throw new AppError('note-missing', 'core.err.generic');
    if (note.photoId) await t.del('media', note.photoId);
    const at = now();
    let photoId = null;
    if (media) {
      photoId = crypto.randomUUID();
      await t.put('media', { id: photoId, kind: 'photo', mime: media.mime, bytes: media.bytes,
        w: media.w ?? 0, h: media.h ?? 0, createdAt: at });
    }
    await t.put('notes', { ...note, photoId, updatedAt: at, localEditAt: at });
  });
}

/** @returns {Promise<import('../types.js').NoteState>} */
export async function getNoteState(id) {
  return (await db.get('noteState', id)) ?? { noteId: id, lastFiredAt: null, mutedUntil: null };
}

export function listNoteStates() {
  return db.getAll('noteState');
}

/** @param {Partial<import('../types.js').NoteState>} patch */
export async function setNoteState(id, patch) {
  await db.tx(['noteState'], 'rw', async (t) => {
    const cur = (await t.get('noteState', id)) ?? { noteId: id, lastFiredAt: null, mutedUntil: null };
    await t.put('noteState', { ...cur, ...patch, noteId: id });
  });
}

/**
 * Zone import: one transaction. Records must already be valid; `update` replaces by id and does
 * not touch localEditAt.
 * @param {{add?: Note[], update?: Note[], media?: import('../types.js').Media[], remove?: string[]}} batch
 */
export async function applyNoteBatch(batch) {
  await db.tx(['notes', 'media', 'noteState'], 'rw', async (t) => {
    const add = batch.add ?? [];
    if (add.length && (await t.count('notes')) + add.length > LIMITS.notes) {
      throw new AppError('notes-limit', 'core.err.notesLimit');
    }
    for (const m of batch.media ?? []) await t.put('media', m);
    for (const n of [...add, ...(batch.update ?? [])]) await t.put('notes', checked(n));
    for (const id of batch.remove ?? []) {
      const n = await t.get('notes', id);
      if (!n) continue;
      if (n.photoId) await t.del('media', n.photoId);
      await t.del('noteState', id);
      await t.del('notes', id);
    }
  });
}

/** "Trovato chiuso" / "Trovato aperto": appends a stamp from the device clock. */
export async function addVisit(id, open) {
  await modify(id, (cur) => ({
    ...cur, visits: addStamp(cur.visits, visitStamp(new Date(now()), open, true)), updatedAt: now(),
  }));
}

/** Removes the newest own stamp. */
export async function undoVisit(id) {
  await modify(id, (cur) => ({ ...cur, visits: removeLastOwn(cur.visits), updatedAt: now() }));
}

/** "Da completare": no text and no photo. @param {Note} n */
export function isIncomplete(n) {
  return n.text === '' && !n.photoId;
}
