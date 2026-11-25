// @ts-check
// Data-slot providers, loaded on demand so the manifest imports nothing from core.
import { t, tn, notes, clock } from '../../../core/api.js';
import { briefingRows, countSince, FILTER_INCOMPLETE } from './note-view.js';

/** Briefing "Oggi occhio a": timed notes of today and stamp lines. @param {{now?:number}} [ctx] */
export async function briefing(ctx) {
  return briefingRows(await notes.listNotes(), ctx?.now ?? clock.now(), t);
}

/** End card: "Note di oggi: 4" and the row "3 note da completare". @param {{shift?:{startAt:number}}} [ctx] */
export async function shiftEnd(ctx) {
  const all = await notes.listNotes();
  const today = countSince(all, ctx?.shift?.startAt ?? clock.now());
  const open = all.filter(notes.isIncomplete).length;
  const rows = [];
  if (today > 0) rows.push({ kind: 'line', icon: 'map-pin', text: t('note.end.today', { n: today }) });
  if (open > 0) {
    rows.push({ kind: 'row', icon: 'pencil', text: tn('note.incomplete.count', open),
      to: `/note?filtro=${FILTER_INCOMPLETE}` });
  }
  return rows;
}

/** Texts of the delete and restore dialogs. */
export async function counts() {
  return [{ labelKey: 'note.count.label', count: await notes.countNotes() }];
}
