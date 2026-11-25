// @ts-check
// Web Audio cues (DESIGN 10.1–10.3). Release 1: 8 cues, no silent-switch override.
import * as store from '../store.js';
import * as settings from '../settings.js';
import * as log from '../log.js';

/** @typedef {'saved'|'shiftStart'|'shiftStop'|'breakEnd'|'alertInfo'|'alertWarning'|'alertDanger'|'error'} CueName */

const n = (f, t, d, g) => ({ f, t, d, g });
const DANGER = [n(1245, 0, 0.12, 0.3), n(932, 0.14, 0.12, 0.3), n(1245, 0.28, 0.12, 0.3), n(932, 0.42, 0.12, 0.3)];
/** @type {Record<CueName, {wave:OscillatorType, notes:{f:number,t:number,d:number,g:number}[], total:number}>} */
const CUES = {
  saved: { wave: 'sine', notes: [n(784, 0, 0.10, 0.5), n(1175, 0.10, 0.22, 0.5)], total: 0.32 },
  shiftStart: { wave: 'triangle', total: 0.73,
    notes: [n(523, 0, 0.12, 0.5), n(659, 0.11, 0.12, 0.5), n(784, 0.22, 0.12, 0.5), n(1047, 0.33, 0.40, 0.5)] },
  shiftStop: { wave: 'triangle', total: 0.71,
    notes: [n(1047, 0, 0.14, 0.5), n(784, 0.13, 0.14, 0.5), n(523, 0.26, 0.45, 0.5)] },
  breakEnd: { wave: 'sine', total: 0.95,
    notes: [n(659, 0, 0.18, 0.5), n(880, 0.20, 0.18, 0.5), n(659, 0.40, 0.18, 0.5), n(880, 0.60, 0.35, 0.5)] },
  alertInfo: { wave: 'sine', notes: [n(880, 0, 0.20, 0.6), n(1319, 0.20, 0.50, 0.6)], total: 0.70 },
  alertWarning: { wave: 'triangle', total: 0.87,
    notes: [n(988, 0, 0.12, 0.6), n(988, 0.16, 0.12, 0.6), n(1319, 0.32, 0.55, 0.6)] },
  alertDanger: { wave: 'square', total: 1.44,
    notes: [...DANGER, ...DANGER.map((x) => ({ ...x, t: x.t + 0.90 }))] },
  error: { wave: 'triangle', notes: [n(587, 0, 0.14, 0.4), n(523, 0.16, 0.28, 0.4)], total: 0.44 },
};
/** @type {Record<CueName, number[]>} */
const HAPTICS = {
  saved: [25, 50, 25], shiftStart: [25, 50, 25], shiftStop: [25, 50, 25], breakEnd: [200, 100, 200],
  alertInfo: [150, 100, 150], alertWarning: [250, 100, 250, 100, 250],
  alertDanger: [500, 150, 500, 150, 500], error: [80, 60, 80],
};

/** @type {AudioContext|null} */
let ctx = null;
/** @type {GainNode|null} */
let master = null;
let unlocked = false;

function setAudio(state) {
  store.setState({ audio: settings.get('sound.level') === 'off' ? 'off' : state });
}

function ensure() {
  if (ctx) return ctx;
  const AC = /** @type {any} */ (window).AudioContext ?? /** @type {any} */ (window).webkitAudioContext;
  if (!AC) return null;
  const c = new AC();
  ctx = c;
  master = c.createGain();
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 6;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.1;
  master.connect(comp).connect(c.destination);
  c.addEventListener('statechange', () => {
    if (c.state !== 'running' && unlocked) c.resume().catch(() => setAudio('locked'));
  });
  return ctx;
}

/** Creates and resumes the AudioContext. Call inside a click. */
export async function unlockAudio() {
  if (typeof window === 'undefined') return;
  const c = ensure();
  if (!c) {
    setAudio('locked');
    return;
  }
  try {
    await c.resume();
    unlocked = c.state === 'running';
  } catch (err) {
    unlocked = false;
    log.warn('cues', 'resume-failed');
  }
  setAudio(unlocked ? 'ok' : 'locked');
}

/** @returns {'locked'|'ok'|'off'} */
export function audioState() {
  if (settings.get('sound.level') === 'off') return 'off';
  return unlocked && ctx?.state === 'running' ? 'ok' : 'locked';
}

/**
 * Sound is alive when currentTime advances within 250 ms. Run on app:visible and every 60 s in a
 * shift; a failure sets store.audio to 'locked'.
 * @returns {Promise<boolean>}
 */
export async function healthCheck() {
  if (settings.get('sound.level') === 'off') {
    setAudio('off');
    return true;
  }
  const c = ctx;
  if (!c || !unlocked) {
    setAudio('locked');
    return false;
  }
  try {
    if (c.state !== 'running') await c.resume();
  } catch (err) {
    log.warn('cues', 'resume-failed');
  }
  const t0 = c.currentTime;
  await new Promise((r) => setTimeout(r, 250));
  const ok = c.state === 'running' && c.currentTime > t0;
  if (!ok) unlocked = false;
  setAudio(ok ? 'ok' : 'locked');
  return ok;
}

/**
 * @param {CueName} name @param {{volume?:number}} [opts]
 * @returns {number} duration in seconds; 0 when locked or sound.level is 'off'
 */
export function playCue(name, opts = {}) {
  const cue = CUES[name];
  const level = settings.get('sound.level');
  if (!cue || level === 'off' || !ctx || !master || !unlocked || ctx.state !== 'running') return 0;
  const c = ctx;
  master.gain.value = 0.8 * (level === 'loud' ? 1.6 : 1) * (opts.volume ?? 1);
  const t0 = c.currentTime + 0.03;
  /** @type {AudioNode} */
  let out = master;
  if (name === 'alertDanger') {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3000;
    lp.connect(master);
    out = lp;
  }
  const voice = (type, f, t, d, g) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(g, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + d + 0.02);
  };
  for (const note of cue.notes) {
    voice(cue.wave, note.f, t0 + note.t, note.d, note.g);
    if (name !== 'alertDanger') voice('sine', note.f * 2, t0 + note.t, note.d, note.g * 0.25);
  }
  return cue.total;
}

/** @param {CueName} name @returns {boolean} false where navigator.vibrate is missing (iPhone) */
export function haptic(name) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function' || !HAPTICS[name]) return false;
  try {
    return navigator.vibrate(HAPTICS[name]);
  } catch (err) {
    return false;
  }
}

export const CUE_NAMES = /** @type {CueName[]} */ (Object.keys(CUES));
