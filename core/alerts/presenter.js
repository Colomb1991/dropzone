// @ts-check
// Alert-card presenter (logic side). The shell injects the renderer with setRenderer().
import * as events from '../events.js';
import * as store from '../store.js';
import * as settings from '../settings.js';
import * as cues from '../platform/cues.js';
import * as speech from '../platform/speech.js';
import { now } from '../clock.js';
import { enqueue } from '../pure/alert-queue.js';
import { cueForTone } from '../pure/catalog.js';
import { SPEED_STOP } from '../pure/driving.js';

/** @typedef {import('../types.js').AlertCardModel} AlertCardModel */

let cfg = { autoCloseMs: 20000, queuedCloseMs: 8000, minGapMs: 8000 };
/** @type {{model:AlertCardModel, ctx:{speed?:number|null, voice?:boolean, silent?:boolean}}[]} */
let queue = [];
/** @type {{model:AlertCardModel, ctx:any, shownAt:number}|null} */
let cur = null;
let closeAt = 0;
let closeTimer = null;
let gapTimer = null;
let voiceTimer = null;
let lastShownAt = -Infinity;
let speakingNow = false;
let renderer = null;
let wired = false;

/** Defaults 20000 / 8000 / 8000; the demo shortens them. */
export function configure(opts) {
  cfg = { ...cfg, ...opts };
}

function render() {
  if (!renderer) return;
  const s = store.getState();
  renderer(cur ? cur.model : null, {
    index: 0, total: (cur ? 1 : 0) + queue.length, speaking: speakingNow,
    moving: s.moving && !s.passenger, closeAt,
  });
}

/** @param {(model:AlertCardModel|null, state:{index:number, total:number, speaking:boolean,
 *   moving:boolean, closeAt:number}) => void} fn */
export function setRenderer(fn) {
  renderer = fn;
  if (!wired) {
    wired = true;
    events.on('driving:changed', render);
    store.subscribe((s) => s.passenger, render);
  }
  render();
}

function speak(model) {
  if (!model.speakText) return;
  speakingNow = true;
  render();
  speech.say(model.speakText, { lang: model.lang === 'en' ? 'en-GB' : 'it-IT' }).then(() => {
    speakingNow = false;
    render();
  });
}

function scheduleClose(at) {
  closeAt = at;
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => close('auto'), Math.max(0, at - now()));
}

function show(item) {
  const t = now();
  cur = { ...item, shownAt: t };
  lastShownAt = t;
  scheduleClose(t + (queue.length ? cfg.queuedCloseMs : cfg.autoCloseMs));
  events.emit('alert:shown', { card: item.model });
  if (!item.ctx.silent) {
    const cue = cueForTone(item.model.tone);
    const dur = cues.playCue(cue);
    cues.haptic(cue);
    // SPEC 6.6: voice on, trigger says voice, speed at firing ≥ 1.4 m/s; 150 ms after the cue.
    const fast = typeof item.ctx.speed === 'number' && item.ctx.speed >= SPEED_STOP;
    if (item.ctx.voice !== false && fast && settings.get('voice.on')) {
      const model = item.model;
      voiceTimer = setTimeout(() => {
        if (cur && cur.model === model) speak(model);
      }, dur * 1000 + 150);
    }
  }
  render();
}

function pump() {
  if (cur) {
    // Another card waits: the current one closes 8 s after it was shown.
    if (queue.length) scheduleClose(Math.min(closeAt, cur.shownAt + cfg.queuedCloseMs));
    render();
    return;
  }
  if (!queue.length) return;
  const wait = lastShownAt + cfg.minGapMs - now();
  if (wait > 0) {
    clearTimeout(gapTimer);
    gapTimer = setTimeout(pump, wait);
    return;
  }
  show(/** @type {any} */ (queue.shift()));
}

function close(how) {
  if (!cur) return;
  clearTimeout(closeTimer);
  clearTimeout(voiceTimer);
  speech.stop();
  speakingNow = false;
  const card = cur.model;
  cur = null;
  store.setState({ lastAlert: { card, at: now() } });
  events.emit('alert:closed', { card, how });
  render();
  pump();
}

/**
 * Queue a card: danger first, then nearest; max 3; one new card every 8 s.
 * @param {AlertCardModel} model
 * @param {{speed?:number|null, voice?:boolean}} [ctx] speed at firing; voice=false for sound-only targets
 */
export function present(model, ctx = {}) {
  if (cur && cur.model.id === model.id) return;
  queue = enqueue(queue, [{ model, ctx }]);
  pump();
}

/** @returns {AlertCardModel|null} */
export function current() {
  return cur ? cur.model : null;
}

/** @param {'seen'|'mute'} how 'mute' = "Non oggi" (the engine mutes the target until midnight) */
export function dismiss(how) {
  close(how);
}

/** "Riascolta". */
export function replay() {
  if (cur) speak(cur.model);
}

/** "Ultimo avviso": shows the last card again, without cue or voice. */
export function reopenLast() {
  const lastAlert = store.getState().lastAlert;
  if (cur || !lastAlert) return;
  show({ model: lastAlert.card, ctx: { silent: true } });
}

/** Drops everything (shift end, demo exit). */
export function reset() {
  queue = [];
  clearTimeout(gapTimer);
  if (cur) close('auto');
}
