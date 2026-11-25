// @ts-check
// Wires the pure proximity functions to sources (notes, colleague alerts, demo), cues and cards.
import * as events from '../events.js';
import * as settings from '../settings.js';
import * as log from '../log.js';
import * as geo from '../geo/geo.js';
import * as cues from '../platform/cues.js';
import * as speech from '../platform/speech.js';
import * as presenter from './presenter.js';
import { now, nextMidnight } from '../clock.js';
import { initialProxState, resetGrace as graceReset, proximityStep, stopCandidates, nearby } from '../pure/proximity.js';
import { NEARBY_RADIUS_M, STOP_RADIUS_M } from '../pure/catalog.js';

/** @typedef {import('../types.js').ProxSource} ProxSource */
/** @typedef {import('../types.js').ProxTarget} ProxTarget */

/** @type {Map<string, ProxSource>} */
const sources = new Map();
/** @type {Map<string, ProxTarget[]>} */
const bySource = new Map();
/** @type {ProxTarget[]} */
let targets = [];
/** @type {Map<string, ProxTarget>} */
let byId = new Map();
let prox = initialProxState();
let running = false;
let shiftStartAt = 0;
let announced = new Set();
const nearbyCbs = new Set();
let lastNearbyAt = 0;
let forceNearby = false;
let wired = false;

function rebuild() {
  targets = [...bySource.values()].flat();
  byId = new Map(targets.map((t) => [t.id, t]));
  emitNearby();
}

async function load(src) {
  try {
    const list = await src.load();
    if (sources.get(src.id) !== src) return;
    bySource.set(src.id, list.map((t) => ({ ...t, source: src.id })));
    rebuild();
  } catch (err) {
    log.error('prox', err, { source: src.id });
  }
}

function wire() {
  if (wired) return;
  wired = true;
  events.on('data:changed', (e) => {
    for (const src of sources.values()) if (src.watch.includes(e.store)) load(src);
  });
  events.on('geo:fix', () => {
    if (forceNearby || now() - lastNearbyAt >= 5000) emitNearby();
  });
  events.on('geo:resumed', () => {
    resetGrace();
    forceNearby = true;
  });
  events.on('alert:closed', (e) => {
    if (e.how === 'mute') muteTarget(e.card.id, nextMidnight(now()));
  });
}

/** Targets are loaded at once and again on data:changed of the `watch` stores. @returns {() => void} */
export function registerSource(src) {
  wire();
  sources.set(src.id, src);
  load(src);
  return () => {
    if (sources.get(src.id) !== src) return;
    sources.delete(src.id);
    bySource.delete(src.id);
    rebuild();
  };
}

/** Reloads every source (after a restore, or a language change that alters card text). */
export function reload() {
  return Promise.all([...sources.values()].map(load));
}

/** Session only. */
export function start(opts) {
  running = true;
  shiftStartAt = opts.shiftStartAt;
  prox = initialProxState();
  announced = new Set();
}

export function stop() {
  running = false;
  presenter.reset();
}

/** Next 10 s: targets go "inside" without firing. */
export function resetGrace() {
  prox = graceReset(prox);
}

async function fire(id, distM, speed) {
  const target = byId.get(id);
  const src = target ? sources.get(target.source) : undefined;
  if (!target || !src) return;
  const at = now();
  target.lastFiredAt = at;
  events.emit('prox:fired', { target, distM, speed });
  try {
    await src.onFired(id, at);
    const card = await src.card(id, { distM, now: at });
    if (card) presenter.present(card, { speed, voice: target.output === 'voice' });
  } catch (err) {
    log.error('prox', err, { source: target.source });
  }
}

/** Session only: one filtered fix of a shift in holder mode. */
export function handleFix(fix) {
  if (!running) return;
  const r = proximityStep(prox, fix, targets, now(), { radiusM: settings.get('alert.radiusM'), shiftStartAt });
  prox = r.state;
  for (const id of r.fire) fire(id, r.dist[id] ?? 0, fix.speed);
}

/**
 * Session only: the vehicle stopped after driving. One cue for the stop-class notes within 60 m,
 * the single word of the first one that has it ("Cane."), and "Cosa so di qui" refreshed.
 * @returns {string[]} announced ids
 */
export function handleStop(fix) {
  if (!running || !fix) return [];
  const ids = stopCandidates(fix, targets, announced, now(), STOP_RADIUS_M);
  if (ids.length === 0) return [];
  const found = /** @type {ProxTarget[]} */ (ids.map((id) => byId.get(id)).filter(Boolean));
  for (const id of ids) announced.add(id);
  const cue = found.some((t) => t.tone === 'danger') ? 'alertDanger' : 'alertInfo';
  const dur = cues.playCue(cue);
  cues.haptic(cue);
  const word = found.find((t) => t.stopSay)?.stopSay;
  if (word) setTimeout(() => speech.say(word), dur * 1000 + 150);
  emitNearby();
  return ids;
}

/** "Non oggi" and its undo. @param {string} id @param {number|null} until */
export async function muteTarget(id, until) {
  const target = byId.get(id);
  const src = target ? sources.get(target.source) : undefined;
  if (!target || !src) return;
  target.mutedUntil = until;
  try {
    await src.onMuted(id, until);
  } catch (err) {
    log.error('prox', err, { source: target.source });
  }
}

/** The loaded target, e.g. to dim a row whose schedule is inactive. @returns {ProxTarget|undefined} */
export function getTarget(id) {
  return byId.get(id);
}

/**
 * "Cosa so di qui": any class, any schedule state; uses the last fix.
 * @param {number} [radiusM] default 150
 * @returns {{id:string, source:string, distM:number}[]} nearest first
 */
export function nearbyNow(radiusM = NEARBY_RADIUS_M) {
  const fix = geo.lastFix();
  if (!fix) return [];
  return nearby(fix, targets, radiusM).map((n) => ({ ...n, source: byId.get(n.id)?.source ?? '' }));
}

function emitNearby() {
  lastNearbyAt = now();
  forceNearby = false;
  if (nearbyCbs.size === 0) return;
  const items = nearbyNow();
  for (const cb of [...nearbyCbs]) {
    try {
      cb(items);
    } catch (err) {
      log.error('prox', err);
    }
  }
}

/** Recomputed at most every 5 s, at once after a resume, and when targets change. */
export function onNearby(cb) {
  wire();
  nearbyCbs.add(cb);
  return () => nearbyCbs.delete(cb);
}

/** Recompute now (after a one-shot position). */
export function refreshNearby() {
  emitNearby();
}
