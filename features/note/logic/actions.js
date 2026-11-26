// @ts-check
// Everything the note screens do to data: proximity source, save, stamps, photo, mute.
import { t, notes, geo, proximity, settings, store, cues, clock, i18n, format, photo, camera, log }
  from '../../../core/api.js';
import { toast } from '../../../ui/kit/index.js';
import { toTarget, cardModel } from './note-view.js';

const FRESH_FIX_MS = 10000;
const logErr = (err) => log.error('note', err);

/** Registers the proximity source `note` (approach and stop classes). @returns {() => void} */
export function registerNoteSource() {
  const off = proximity.registerSource({
    id: 'note',
    watch: ['notes', 'noteState'],
    load: async () => {
      const [all, states] = await Promise.all([notes.listNotes(), notes.listNoteStates()]);
      const byId = new Map(states.map((s) => [s.noteId, s]));
      const word = t('core.voice.cane');
      return all.map((n) => toTarget(n, byId.get(n.id), word));
    },
    card: async (id, ctx) => {
      const n = await notes.getNote(id);
      if (!n) return null;
      return cardModel(n, { distM: ctx.distM, now: ctx.now, lang: i18n.getLang(), t,
        scheduleLabel: format.scheduleLabel, dateShort: format.dateShort });
    },
    onFired: (id, at) => notes.setNoteState(id, { lastFiredAt: at }),
    onMuted: (id, until) => notes.setNoteState(id, { mutedUntil: until }),
  });
  // The stop word and the card text follow the language.
  const offLang = store.subscribe((s) => s.lang, () => proximity.reload().catch(logErr));
  return () => {
    off();
    offLang();
  };
}

/**
 * Position and time of "Nota qui": the live fix when it is fresh, else one reading.
 * @returns {Promise<{lat:number, lon:number, acc:number|null, at:number}|null>}
 */
export async function positionNow() {
  const at = clock.now();
  const last = geo.lastFix();
  const fix = last && at - last.ts <= FRESH_FIX_MS
    ? last : await geo.currentPosition({ timeoutMs: 8000, maxAgeMs: FRESH_FIX_MS });
  return fix ? { lat: fix.lat, lon: fix.lon, acc: fix.acc ?? null, at } : null;
}

/** True while the driver must not touch (the shell also makes the page inert). */
export function isLocked() {
  const s = store.getState();
  return s.moving && !s.passenger;
}

/**
 * "Salva nota" of "Nota qui": saves, plays the cue, offers the undo.
 * @param {{lat:number, lon:number, acc:number|null, at:number, here?:boolean}} pos `here`: the
 *   courier's own position (not a point picked on the map) @param {string} cat @param {string} [text]
 */
export async function saveNote(pos, cat, text = '') {
  const first = (await notes.countNotes()) === 0;
  const note = await notes.createNote({ lat: pos.lat, lon: pos.lon, acc: pos.acc, cat, text, at: pos.at,
    here: pos.here === true });
  cues.playCue('saved');
  cues.haptic('saved');
  toast(t(first ? 'note.saved.first' : 'note.saved.toast'), {
    icon: 'check', ms: 8000,
    action: { label: t('core.action.undo'), onClick: () => notes.deleteNote(note.id).catch(logErr) },
  });
  return note;
}

/** "Trovato chiuso" / "Trovato aperto": one tap, toast with undo. */
export async function stampVisit(id, open) {
  const at = clock.now();
  await notes.addVisit(id, open);
  const day = new Date(at).getDay() || 7;
  toast(t('note.visit.marked', {
    state: t(open ? 'note.visit.stateOpen' : 'note.visit.stateClosed'),
    day: format.weekday(day), time: format.time(at),
  }), { icon: 'check', action: { label: t('core.action.undo'), onClick: () => notes.undoVisit(id).catch(logErr) } });
}

/** "Silenzia per oggi" and the card's "Non oggi": until local midnight, with undo. */
export async function muteToday(id) {
  const until = clock.nextMidnight(clock.now());
  if (proximity.getTarget(id)) await proximity.muteTarget(id, until);
  else await notes.setNoteState(id, { mutedUntil: until });
  toast(t('core.alert.muted'), { icon: 'bell-off', action: { label: t('core.action.undo'), onClick: () => {
    const undo = proximity.getTarget(id) ? proximity.muteTarget(id, null)
      : notes.setNoteState(id, { mutedUntil: null });
    undo.catch(logErr);
  } } });
}

/**
 * Opens the camera (must be the first thing a click does), then stores the downscaled photo.
 * The note is already saved when this runs. @returns {Promise<boolean>} false when cancelled
 */
export async function shootPhoto(id) {
  const file = await camera.takePhoto();
  if (!file) return false;
  const m = await photo.processPhoto(file, photo.PHOTO_NOTE);
  await notes.setNoteMedia(id, 'photo', m);
  toast(t('note.photo.saved'), { icon: 'check' });
  return true;
}

/** True when the first-photo notice must be shown before the camera. */
export function needsPhotoNotice() {
  return settings.get('firstPhotoWarned') !== true;
}
