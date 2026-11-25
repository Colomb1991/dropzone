// @ts-check
// Diario furgone (SPEC 4.11): record rules, the burnt-in stamp, grouping. Pure.
import { LIMITS } from '../../../core/pure/catalog.js';
import { isLat, isLon } from '../../../core/pure/validators.js';

/** The four guided corners, in the order of SPEC 3.2. */
export const CORNERS = /** @type {const} */ (['fl', 'fr', 'rr', 'rl']);
export const EXTRA = 'extra';
export const MAX_PHOTOS = LIMITS.vanPhotos;
export const MAX_EXTRA = MAX_PHOTOS - CORNERS.length;
export const OLD_DAYS = 45;
const DAY_MS = 86400000;

/** @typedef {{label:string, mediaId:string, bytes:number, at:number}} VanPhoto */
/** @typedef {{id:string, shiftId:string|null, kind:'start'|'end', at:number, lat:number|null,
 *   lon:number|null, acc:number|null, photos:VanPhoto[], updatedAt:number}} VanSession */

const isTs = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 80;

/** `van` record: shared by the store and by backup restore. @returns {VanSession|null} */
export function validateVan(rec) {
  if (!rec || typeof rec !== 'object' || !isId(rec.id) || !isTs(rec.at)) return null;
  if (rec.kind !== 'start' && rec.kind !== 'end') return null;
  if (!Array.isArray(rec.photos) || rec.photos.length > MAX_PHOTOS) return null;
  const photos = [];
  for (const p of rec.photos) {
    if (!p || typeof p !== 'object' || !isId(p.mediaId) || typeof p.label !== 'string' || p.label.length > 40) return null;
    photos.push({ label: p.label, mediaId: p.mediaId,
      bytes: Number.isFinite(p.bytes) && p.bytes > 0 ? p.bytes : 0, at: isTs(p.at) ? p.at : rec.at });
  }
  const located = isLat(rec.lat) && isLon(rec.lon);
  return {
    id: rec.id, shiftId: isId(rec.shiftId) ? rec.shiftId : null, kind: rec.kind, at: rec.at,
    lat: located ? rec.lat : null, lon: located ? rec.lon : null,
    acc: located && Number.isFinite(rec.acc) && rec.acc >= 0 ? rec.acc : null,
    photos, updatedAt: isTs(rec.updatedAt) ? rec.updatedAt : rec.at,
  };
}

/** @returns {VanSession} */
export function newSession({ id, kind, shiftId, at }) {
  return { id, shiftId: shiftId ?? null, kind, at, lat: null, lon: null, acc: null, photos: [], updatedAt: at };
}

const p2 = (n) => String(n).padStart(2, '0');

/**
 * The strip burnt into the picture: `25/11/2026 07:42 · 45.46420, 9.19000 ±12 m · Davanti sinistra`.
 * Local time of the phone. Without a fix the middle part is `noPosition`.
 * @param {{at:number, lat?:number|null, lon?:number|null, acc?:number|null, label:string, noPosition:string}} s
 */
export function stampText(s) {
  const d = new Date(s.at);
  const when = `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  const where = isLat(s.lat) && isLon(s.lon)
    ? `${Number(s.lat).toFixed(5)}, ${Number(s.lon).toFixed(5)}${Number.isFinite(s.acc) ? ` ±${Math.round(Number(s.acc))} m` : ''}`
    : s.noPosition;
  return `${when} · ${where} · ${s.label}`;
}

/** `furgone-20261125-074210.jpg`: local date and time of the shot (unique inside a session). */
export function photoFileName(at) {
  const d = new Date(at);
  return `furgone-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`
    + `-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.jpg`;
}

/** The corner to shoot next, or null when the four are done. */
export function nextCorner(photos) {
  const done = new Set(photos.map((p) => p.label));
  return CORNERS.find((c) => !done.has(c)) ?? null;
}

export function extraCount(photos) {
  return photos.filter((p) => p.label === EXTRA).length;
}

/** False at 8 extras or 12 photos. */
export function canAddExtra(photos) {
  return extraCount(photos) < MAX_EXTRA && photos.length < MAX_PHOTOS;
}

/**
 * Adds a photo. A corner taken again replaces its earlier shot; extras pile up.
 * The first fix of the session becomes its position.
 * @param {VanSession} session @param {VanPhoto} photo
 * @param {{lat:number, lon:number, acc:number}|null} fix
 * @returns {{session:VanSession, replaced:string|null}} `replaced` = media id to delete
 */
export function addPhoto(session, photo, fix) {
  const old = photo.label === EXTRA ? undefined : session.photos.find((p) => p.label === photo.label);
  const rest = old ? session.photos.filter((p) => p !== old) : session.photos;
  if (rest.length >= MAX_PHOTOS) return { session, replaced: null };
  const order = (p) => (p.label === EXTRA ? CORNERS.length : CORNERS.indexOf(/** @type {any} */ (p.label)));
  const photos = [...rest, photo].sort((a, b) => order(a) - order(b) || a.at - b.at);
  const located = session.lat !== null || !fix;
  return {
    session: { ...session, photos, updatedAt: photo.at,
      lat: located ? session.lat : fix.lat, lon: located ? session.lon : fix.lon,
      acc: located ? session.acc : fix.acc },
    replaced: old ? old.mediaId : null,
  };
}

/** Local "YYYY-MM-DD". */
export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/**
 * The session a new photo goes into: today's session of that kind (of the running shift, when
 * there is one), or null when a new one must start.
 * @param {VanSession[]} sessions @param {'start'|'end'} kind @param {string|null} shiftId @param {number} now
 */
export function currentSession(sessions, kind, shiftId, now) {
  const today = dayKey(now);
  const same = sessions.filter((s) => s.kind === kind && dayKey(s.at) === today
    && (shiftId === null || s.shiftId === null || s.shiftId === shiftId));
  return same.sort((a, b) => b.at - a.at)[0] ?? null;
}

/** "Fine turno" late in a shift or right after it, otherwise "Inizio turno". */
export function defaultKind({ shift, lastEndedAt, now }) {
  if (shift) return now - shift.startAt >= 3 * 3600000 ? 'end' : 'start';
  return typeof lastEndedAt === 'number' && now - lastEndedAt >= 0 && now - lastEndedAt <= 2 * 3600000 ? 'end' : 'start';
}

/** History: sessions that hold photos, newest day first. @returns {{day:string, sessions:VanSession[]}[]} */
export function groupByDay(sessions) {
  /** @type {Map<string, VanSession[]>} */
  const days = new Map();
  for (const s of [...sessions].filter((x) => x.photos.length > 0).sort((a, b) => b.at - a.at)) {
    const key = dayKey(s.at);
    if (!days.has(key)) days.set(key, []);
    /** @type {VanSession[]} */ (days.get(key)).push(s);
  }
  return [...days.entries()].map(([day, list]) => ({ day, sessions: list }));
}

/** Photos older than 45 days: they are never deleted by the app, only pointed out. */
export function oldPhotos(sessions, now) {
  let count = 0;
  let bytes = 0;
  for (const s of sessions) {
    if (now - s.at <= OLD_DAYS * DAY_MS) continue;
    count += s.photos.length;
    for (const p of s.photos) bytes += p.bytes;
  }
  return { count, bytes };
}

export function sessionBytes(session) {
  return session.photos.reduce((sum, p) => sum + p.bytes, 0);
}
