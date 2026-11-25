// @ts-check
// One 1 Hz timer for the whole app, stopped while the page is hidden. Also the source of
// app:visible / app:hidden and of store.online.
import { now } from './clock.js';
import * as events from './events.js';
import * as store from './store.js';
import * as log from './log.js';

/** @type {Set<{cb:Function, every:number, last:number}>} */
const subs = new Set();
let timer = null;
let started = false;

function beat() {
  const t = now();
  for (const s of [...subs]) {
    if (t - s.last < s.every - 50) continue;
    s.last = t;
    try {
      s.cb(t);
    } catch (err) {
      log.error('tick', err);
    }
  }
}

function visible() {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

function sync() {
  const want = started && subs.size > 0 && visible();
  if (want && timer === null) timer = setInterval(beat, 1000);
  if (!want && timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

/** @param {(now:number)=>void} cb @param {1000|5000|60000} [everyMs] @returns {() => void} */
export function onTick(cb, everyMs = 1000) {
  const sub = { cb, every: everyMs, last: now() };
  subs.add(sub);
  sync();
  return () => {
    subs.delete(sub);
    sync();
  };
}

/** Boot calls this once. Idempotent. */
export function start() {
  if (started) return;
  started = true;
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      sync();
      if (visible()) {
        beat();
        events.emit('app:visible', {});
      } else {
        events.emit('app:hidden', {});
      }
    });
  }
  if (typeof window !== 'undefined') {
    const online = () => store.setState({ online: navigator.onLine !== false });
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    online();
  }
  sync();
}
