// @ts-check
// Pure helpers of the notes feature: no DOM, no storage. `t` is passed in so Node can test the copy.
import { category, catLabelKey, catVoiceKey, cutAtWord } from '../../../core/pure/catalog.js';
import { scheduleStatus, activeToday, isoDay } from '../../../core/pure/schedule.js';
import { visitPattern } from '../../../core/pure/visits.js';
import { distM } from '../../../core/pure/geo-math.js';
import { hasEnforcementWord, cleanText } from '../../../core/pure/validators.js';

/** @typedef {import('../../../core/types.js').Note} Note */
/** @typedef {(key:string, params?:object) => string} T */

export const FILTER_INCOMPLETE = 'da-completare';
export const TITLE_MAX = 30;
export const TEXT_MAX = 140;

/** "7" for 07:00, "7:30" for 07:30. */
export function shortTime(hhmm) {
  const [h, m] = String(hhmm).split(':');
  return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`;
}

/** @param {Note} n */
export function isIncomplete(n) {
  return n.text === '' && !n.photoId;
}

/** Short name of a note for one-line rows: start of the text, or the category. @param {Note} n @param {T} t */
export function noteTitle(n, t, max = TITLE_MAX) {
  const text = String(n.text ?? '').trim();
  if (!text) return t(catLabelKey(n.cat));
  return text.length <= max ? text : `${cutAtWord(text, max - 1)}…`;
}

/**
 * Proximity target of a note (ARCHITECTURE 0.0 row 2.8).
 * @param {Note} n @param {{lastFiredAt:number|null, mutedUntil:number|null}|undefined} state
 * @param {string|null} stopWord the word spoken at a stop for voice categories of the stop class
 * @returns {import('../../../core/types.js').ProxTarget}
 */
export function toTarget(n, state, stopWord) {
  const c = category(n.cat);
  return {
    id: n.id, source: 'note', lat: n.lat, lon: n.lon, cls: c.cls, fixedRadiusM: null, tone: c.tone,
    output: c.output, schedule: n.schedule ?? null, cooldown: 'shift',
    lastFiredAt: state?.lastFiredAt ?? null, mutedUntil: state?.mutedUntil ?? null,
    stopSay: c.cls === 'stop' && c.voice ? stopWord : null,
  };
}

/**
 * Model of the approach card (SPEC 3.2 "Avviso", 6.2, 6.6).
 * @param {Note} n
 * @param {{distM:number, now:number, lang:'it'|'en', t:T, scheduleLabel:(s:any)=>string,
 *   dateShort:(ts:number)=>string}} ctx
 * @returns {import('../../../core/types.js').AlertCardModel}
 */
export function cardModel(n, ctx) {
  const { t } = ctx;
  const c = category(n.cat);
  const voiceKey = catVoiceKey(n.cat);
  const label = t(catLabelKey(n.cat));
  const text = String(n.text ?? '').trim();
  const lead = n.schedule ? scheduleStatus(n.schedule, new Date(ctx.now)).leadMin : null;
  const meta = n.schedule
    ? `${ctx.scheduleLabel(n.schedule)} · ${t('core.alert.sign')}`
    : t('note.meta.saved', { date: ctx.dateShort(n.createdAt) });
  const spoken = voiceKey && c.voice ? [t(voiceKey), cutAtWord(text)].filter(Boolean).join(' ') : null;
  return {
    id: n.id, source: 'note', tone: c.tone, icon: c.icon,
    title: voiceKey ? t(voiceKey).replace(/\.$/, '') : label,
    text: text || label, meta, prefix: lead ? t('core.alert.leadIn', { n: lead }) : undefined,
    distM: ctx.distM, photoId: n.photoId ?? null, speakText: spoken, lang: ctx.lang,
  };
}

/** Text of one pattern line (SPEC 6.10). @param {import('../../../core/pure/visits.js').VisitLine} l @param {T} t */
export function visitLineText(l, t) {
  const day = l.day ? t(`core.day.long.${l.day}`) : '';
  const s = t(`core.visit.${l.kind}`, { day, hour: l.hour, closed: l.closed, open: l.open, total: l.total });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Pattern of a business note, ready to show. @param {Note} n @param {number} now @param {T} t */
export function visitInfo(n, now, t) {
  if (!n.biz) return { lines: [], closedNow: false };
  const p = visitPattern(n.visits ?? [], now);
  return { lines: p.lines.map((l) => visitLineText(l, t)), closedNow: p.closedNow };
}

/**
 * Filter of the list screen. @param {Note[]} notes
 * @param {string} filter '' = all, FILTER_INCOMPLETE, or a category id
 */
export function filterNotes(notes, filter) {
  if (!filter) return notes;
  if (filter === FILTER_INCOMPLETE) return notes.filter(isIncomplete);
  return notes.filter((n) => n.cat === filter);
}

/**
 * Nearest first with a position, newest first without.
 * @param {Note[]} notes @param {{lat:number, lon:number}|null} fix
 * @returns {{note:Note, distM:number|null}[]}
 */
export function sortNotes(notes, fix) {
  if (!fix) return [...notes].sort((a, b) => b.updatedAt - a.updatedAt).map((note) => ({ note, distM: null }));
  return notes.map((note) => ({ note, distM: distM(fix.lat, fix.lon, note.lat, note.lon) }))
    .sort((a, b) => a.distM - b.distM);
}

/**
 * Briefing "Oggi occhio a": timed notes that apply today (max 5), then stamp lines (max 3, most
 * stamps first). SPEC 3.2, 6.10.
 * @param {Note[]} notes @param {number} now @param {T} t
 * @returns {{icon:string, text:string, to:string}[]}
 */
export function briefingRows(notes, now, t) {
  const date = new Date(now);
  const timed = [];
  const stamps = [];
  for (const n of notes) {
    const c = category(n.cat);
    const today = activeToday(n.schedule, date);
    if (today) {
      const when = today.to ? t('note.briefing.until', { to: shortTime(today.to) }) : t('note.briefing.allDay');
      timed.push({ from: today.from ?? '', row: { icon: c.icon, text: `${noteTitle(n, t)} · ${when}`,
        to: `/note/${n.id}` } });
    }
    if (!n.biz) continue;
    const line = visitPattern(n.visits ?? [], now).lines
      .find((l) => l.kind === 'A' || ((l.kind === 'B' || l.kind === 'C') && l.day === isoDay(date)));
    if (!line) continue;
    const key = line.kind === 'C' ? 'note.briefing.closedDay' : 'note.briefing.closedHour';
    const text = `${noteTitle(n, t)} · ${t(key, { hour: line.hour, closed: line.closed, total: line.total })}`;
    stamps.push({ total: line.total, row: { icon: 'door-closed', text, to: `/note/${n.id}` } });
  }
  timed.sort((a, b) => a.from.localeCompare(b.from));
  stamps.sort((a, b) => b.total - a.total);
  return [...timed.slice(0, 5).map((x) => x.row), ...stamps.slice(0, 3).map((x) => x.row)];
}

/** Why a text cannot be saved: null, 'words' (notice 26) or 'long'. */
export function textProblem(text) {
  if (hasEnforcementWord(text)) return 'words';
  return cleanText(text).length > TEXT_MAX ? 'long' : null;
}

/** A draft schedule of the editor, or null when it is not valid yet. @returns {object|null|undefined} */
export function draftSchedule(always, days, windows) {
  if (always) return null;
  if (!days.length) return undefined;
  const wins = windows.filter((w) => w.from && w.to);
  if (wins.length !== windows.length) return undefined;
  return { days: [...days].sort((a, b) => a - b), windows: wins.slice(0, 2) };
}

/** Notes created since `sinceAt` (end card "Note di oggi"). */
export function countSince(notes, sinceAt) {
  return notes.filter((n) => n.origin === 'mine' && n.createdAt >= sinceAt).length;
}
