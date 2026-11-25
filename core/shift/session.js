// @ts-check
// Shift lifecycle. Modes: 'holder' (GPS watch + wake lock, alerts, driving lock) and 'pocket'
// (no watch, never moving, one fix on every return to the app).
import * as db from '../db/db.js';
import * as events from '../events.js';
import * as store from '../store.js';
import * as settings from '../settings.js';
import * as log from '../log.js';
import * as geo from '../geo/geo.js';
import * as shifts from '../model/shifts.js';
import * as engine from '../alerts/proximity-engine.js';
import * as cues from '../platform/cues.js';
import * as speech from '../platform/speech.js';
import * as wake from '../platform/wake.js';
import { now } from '../clock.js';
import { onTick } from '../tick.js';
import { t } from '../i18n.js';
import { AppError } from '../errors.js';
import { initialDrivingState, drivingStep, SPEED_FAST } from '../pure/driving.js';

/** @typedef {import('../types.js').Shift} Shift */
export const STALE_MS = 3 * 3600000;

/** @type {Shift|null} */
let shift = null;
let driving = initialDrivingState();
let offs = [];
let lastSeenWrite = 0;
let breakCued = false;
let movingAfterBreakSince = null;
let gpsLostAt = null;
let gpsLostSaid = false;

const sayAfter = (key, cueDur) => setTimeout(() => speech.say(t(key)), cueDur * 1000 + 150);
const openBreak = (s) => (s ? s.breaks.find((b) => b.endAt === null) ?? null : null);
const plannedEnd = (b) => b.startAt + b.plannedMin * 60000;

function setShift(s) {
  shift = s;
  store.setState({ shift: s, onBreak: openBreak(s) !== null });
}

async function patch(fn) {
  if (!shift) throw new AppError('no-shift', 'core.err.generic');
  const next = await shifts.patchShift(shift.id, fn);
  if (shift && shift.id === next.id) setShift(next);
  return next;
}

function applyDriving(next) {
  const prev = driving;
  driving = next;
  if (prev.label === next.label) return;
  store.setState({ moving: next.label !== 'stopped', fast: next.label === 'fast' });
  events.emit('driving:changed', { moving: next.label !== 'stopped', fast: next.label === 'fast', label: next.label });
  // Stop trigger: only after a phase that reached 15 km/h (SPEC 6.1).
  if (next.label === 'stopped' && next.peak >= SPEED_FAST) engine.handleStop(geo.lastFix());
}

function onFix(fix) {
  if (!shift || shift.mode !== 'holder') return;
  applyDriving(drivingStep(driving, fix, now()));
  engine.handleFix(fix);
}

function checkBreak(tNow, returning) {
  const b = openBreak(shift);
  if (!b) {
    movingAfterBreakSince = null;
    return;
  }
  const end = plannedEnd(b);
  if (tNow < end) return;
  if (returning && tNow - end > 5000) {
    // Back in the app after the planned end: closed at the planned end (SPEC 4.2).
    endBreak({ at: end, auto: true }).catch((err) => log.error('session', err));
    return;
  }
  if (!breakCued) {
    breakCued = true;
    sayAfter('core.say.breakEnd', cues.playCue('breakEnd'));
    cues.haptic('breakEnd');
  }
  if (store.getState().moving) {
    movingAfterBreakSince ??= tNow;
    if (tNow - movingAfterBreakSince >= 60000) {
      endBreak({ at: end, auto: true }).catch((err) => log.error('session', err));
    }
  } else {
    movingAfterBreakSince = null;
  }
}

function onSecond(tNow) {
  if (!shift) return;
  if (shift.mode === 'holder') applyDriving(drivingStep(driving, null, tNow));
  checkBreak(tNow, false);
  if (gpsLostAt !== null && !gpsLostSaid && tNow - gpsLostAt >= 60000) {
    gpsLostSaid = true;
    sayAfter('core.say.gpsLost', cues.playCue('error'));
  }
  if (tNow - lastSeenWrite >= 60000) {
    lastSeenWrite = tNow;
    patch((s) => ({ ...s, lastSeenAt: tNow })).catch((err) => log.error('session', err));
    cues.healthCheck();
  }
}

function onGpsState(e) {
  if (e.state === 'paused' || e.state === 'unavailable') {
    gpsLostAt ??= now();
  } else if (e.state === 'ok' || e.state === 'imprecise') {
    if (gpsLostSaid) speech.say(t('core.say.gpsBack'));
    gpsLostAt = null;
    gpsLostSaid = false;
  }
}

function onVisible() {
  if (!shift) return;
  const tNow = now();
  if (tNow - shift.lastSeenAt >= STALE_MS) events.emit('shift:resumed', { shift, stale: true });
  cues.healthCheck();
  checkBreak(tNow, true);
  if (shift.mode === 'holder') wake.acquire();
  else geo.currentPosition({ maxAgeMs: 10000 }).then(() => engine.refreshNearby());
  lastSeenWrite = tNow;
  patch((s) => ({ ...s, lastSeenAt: tNow })).catch((err) => log.error('session', err));
}

function applyMode(mode, withLocation = true) {
  if (mode === 'holder') {
    wake.acquire();
    if (withLocation) geo.start();
  } else {
    geo.stop();
    wake.release();
    driving = initialDrivingState();
    store.setState({ moving: false, fast: false });
    if (withLocation) geo.currentPosition().then(() => engine.refreshNearby());
  }
}

function wire() {
  unwire();
  driving = initialDrivingState();
  breakCued = false;
  gpsLostAt = null;
  gpsLostSaid = false;
  lastSeenWrite = now();
  engine.start({ shiftStartAt: /** @type {Shift} */ (shift).startAt });
  offs = [
    geo.onFix(onFix),
    onTick(onSecond, 1000),
    events.on('app:visible', onVisible),
    events.on('geo:state', onGpsState),
    events.on('prox:fired', () => {
      patch((s) => ({ ...s, alertsFired: s.alertsFired + 1 })).catch((err) => log.error('session', err));
    }),
    settings.onChange('shift.mode', (mode) => {
      if (!shift || !mode || mode === shift.mode) return;
      patch((s) => ({ ...s, mode })).then(() => applyMode(mode)).catch((err) => log.error('session', err));
    }),
  ];
}

function unwire() {
  for (const off of offs) off();
  offs = [];
}

/**
 * MUST be called directly in a click handler: before its first await it unlocks sound and speech
 * and, in holder mode, asks for the wake lock and starts the GPS watch.
 * @param {{location?:boolean, startAt?:number}} [opts] location=false: "Non ora" (no position)
 * @returns {Promise<Shift>}
 */
export function startShift(opts = {}) {
  if (shift) return Promise.resolve(shift);
  const mode = settings.get('shift.mode') ?? 'holder';
  cues.unlockAudio();
  speech.unlock();
  applyMode(mode, opts.location !== false);
  return (async () => {
    const at = now();
    /** @type {Shift} */
    const rec = { id: crypto.randomUUID(), startAt: opts.startAt ?? at, endAt: null, mode, breaks: [],
      edited: opts.startAt !== undefined, alertsFired: 0, lastSeenAt: at };
    await shifts.saveShift(rec);
    await shifts.setActiveId(rec.id);
    setShift(rec);
    store.setState({ passenger: false });
    wire();
    events.emit('shift:started', { shift: rec });
    sayAfter('core.say.shiftStart', cues.playCue('shiftStart'));
    cues.haptic('shiftStart');
    db.requestPersist();
    return rec;
  })();
}

/** @param {{endAt?:number, autoClosed?:boolean}} [opts] endAt: recovery of a forgotten stop */
export async function endShift(opts = {}) {
  if (!shift) throw new AppError('no-shift', 'core.err.generic');
  const endAt = opts.endAt ?? now();
  const done = await patch((s) => ({
    ...s, endAt: Math.max(endAt, s.startAt), edited: s.edited || opts.endAt !== undefined,
    // A break still open is closed at its planned end and flagged (SPEC 6.4).
    breaks: s.breaks.map((b) => (b.endAt === null
      ? { ...b, endAt: Math.max(b.startAt, Math.min(plannedEnd(b), endAt)), auto: true } : b)),
  }));
  await shifts.setActiveId(null);
  unwire();
  engine.stop();
  geo.stop();
  wake.release();
  cues.playCue('shiftStop');
  cues.haptic('shiftStop');
  shift = null;
  store.setState({ shift: null, onBreak: false, moving: false, fast: false, passenger: false });
  events.emit('shift:ended', { shift: done, autoClosed: opts.autoClosed === true });
  return done;
}

/**
 * Boot. 'stale' = not seen for 3 h or more: F1 shows the recovery dialog.
 * @returns {Promise<'none'|'resumed'|'stale'>}
 */
export async function resumeIfOpen() {
  const id = await shifts.getActiveId();
  const rec = id ? await shifts.getShift(id) : undefined;
  if (!rec || rec.endAt !== null) {
    if (id) await shifts.setActiveId(null);
    return 'none';
  }
  const stale = now() - rec.lastSeenAt >= STALE_MS;
  setShift(rec);
  // Sound needs a tap after a reload: the shell calls rearmAudio() on the first click.
  store.setState({ audio: settings.get('sound.level') === 'off' ? 'off' : 'locked', voice: 'locked' });
  applyMode(rec.mode);
  wire();
  checkBreak(now(), true);
  events.emit('shift:resumed', { shift: rec, stale });
  return stale ? 'stale' : 'resumed';
}

/** @returns {Shift|null} */
export function active() {
  return shift;
}

export function isStale() {
  return shift !== null && now() - shift.lastSeenAt >= STALE_MS;
}

/** Changes the start of the running shift ("Cambia" in the briefing). */
export function setStart(startAt) {
  return patch((s) => ({ ...s, startAt, edited: true }));
}

/** @param {{plannedMin?:number}} [opts] default: setting shift.breakMin */
export async function startBreak(opts = {}) {
  if (openBreak(shift)) return;
  const at = now();
  breakCued = false;
  movingAfterBreakSince = null;
  const s = await patch((cur) => ({ ...cur,
    breaks: [...cur.breaks, { startAt: at, endAt: null, plannedMin: opts.plannedMin ?? settings.get('shift.breakMin') }] }));
  events.emit('break:started', { shift: s, at });
}

/** @param {{at?:number, auto?:boolean}} [opts] */
export async function endBreak(opts = {}) {
  if (!openBreak(shift)) return;
  const at = opts.at ?? now();
  const s = await patch((cur) => ({ ...cur, breaks: cur.breaks.map((b) => (b.endAt === null
    ? { ...b, endAt: Math.max(b.startAt, at), ...(opts.auto ? { auto: true } : {}) } : b)) }));
  events.emit('break:ended', { shift: s, at, auto: opts.auto === true });
}

/** "+5 min". */
export function extendBreak(min) {
  breakCued = false;
  patch((s) => ({ ...s, breaks: s.breaks.map((b) => (b.endAt === null ? { ...b, plannedMin: b.plannedMin + min } : b)) }))
    .catch((err) => log.error('session', err));
}

/** Planned end of the running break, or null. */
export function breakEndsAt() {
  const b = openBreak(shift);
  return b ? plannedEnd(b) : null;
}

/** "Sono passeggero": per shift, only when stopped; ends with the shift. */
export function setPassenger(on) {
  store.setState({ passenger: on === true && shift !== null });
}

/** Call in a click: unlocks sound and speech again (banner "Tocca per riattivare suono e voce."). */
export function rearmAudio() {
  cues.unlockAudio();
  speech.unlock();
}
