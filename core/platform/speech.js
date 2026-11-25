// @ts-check
// Speech with voices installed on the phone only (localService === true).
import * as store from '../store.js';
import * as settings from '../settings.js';
import * as log from '../log.js';
import { getLang } from '../i18n.js';
import { cutAtWord } from '../pure/catalog.js';

let unlocked = false;
let pending = null;
/** Kept until onend: some engines drop an utterance that is garbage-collected. */
let current = null;

const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

/** @param {'it'|'en'} lang @returns {SpeechSynthesisVoice|null} */
function pickVoice(lang) {
  const s = synth();
  if (!s) return null;
  const voices = s.getVoices().filter((v) => v.localService === true && v.lang.toLowerCase().startsWith(lang));
  const region = lang === 'en' ? 'en-gb' : 'it-it';
  return voices.find((v) => v.lang.toLowerCase().replace('_', '-') === region) ?? voices[0] ?? null;
}

/** @param {'it'|'en'} lang @returns {{name:string, local:boolean}|null} null = no local voice */
export function voiceInfo(lang) {
  const v = pickVoice(lang);
  return v ? { name: v.name, local: true } : null;
}

function sync() {
  let voice = 'ok';
  if (!settings.get('voice.on')) voice = 'off';
  else if (!synth() || !voiceInfo(getLang())) voice = 'none';
  else if (!unlocked) voice = 'locked';
  store.setState({ voice: /** @type {any} */ (voice) });
}

/** Speaks a zero-volume utterance inside a click. */
export function unlock() {
  const s = synth();
  if (s) {
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      s.speak(u);
      unlocked = true;
    } catch (err) {
      log.warn('speech', 'unlock-failed');
    }
  }
  sync();
}

/** Refreshes store.voice (voices load late; settings change). */
export function refresh() {
  sync();
}

/**
 * Queue of one: a new call replaces a waiting one.
 * @param {string} text @param {{lang?:'it-IT'|'en-GB', rate?:number}} [opts]
 * @returns {Promise<'done'|'skipped'|'error'>}
 */
export function say(text, opts = {}) {
  const s = synth();
  const lang = opts.lang ? /** @type {'it'|'en'} */ (opts.lang.slice(0, 2)) : getLang();
  const voice = pickVoice(lang);
  if (!s || !unlocked || !settings.get('voice.on') || !voice || !text) return Promise.resolve('skipped');
  if (pending) {
    clearTimeout(pending.timer);
    pending.resolve('skipped');
    pending = null;
  }
  return new Promise((resolve) => {
    s.cancel();
    const timer = setTimeout(() => {
      pending = null;
      const u = new SpeechSynthesisUtterance(cutAtWord(text, 200));
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = opts.rate ?? settings.get('voice.rate');
      const end = (result) => {
        if (current === u) current = null;
        resolve(result);
      };
      u.onend = () => end('done');
      u.onerror = () => end('error');
      current = u;
      try {
        s.speak(u);
      } catch (err) {
        end('error');
      }
    }, 150);
    pending = { timer, resolve };
  });
}

export function stop() {
  if (pending) {
    clearTimeout(pending.timer);
    pending.resolve('skipped');
    pending = null;
  }
  synth()?.cancel();
  current = null;
}

export function speaking() {
  return current !== null || pending !== null;
}
