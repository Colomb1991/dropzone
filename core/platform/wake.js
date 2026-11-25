// @ts-check
// Screen wake lock. No video fallback in Release 1: 'none' shows the Auto-Lock sheet and banner.
import * as store from '../store.js';
import * as log from '../log.js';

/** @type {any} */
let sentinel = null;
/** @type {'off'|'native'|'none'} */
let current = 'off';
/** True between acquire() and release(): whether the app wants the screen kept on right now. */
let wanted = false;
/** @type {Promise<'off'|'native'|'none'>|null} the one request in flight, shared by every caller */
let pending = null;

function set(m) {
  current = m;
  store.setState({ wake: m });
}

function drop(s) {
  if (s && !s.released) s.release().catch(() => log.warn('wake', 'release-failed'));
}

async function request(wl) {
  let s = null;
  try {
    s = await wl.request('screen');
  } catch (err) {
    log.warn('wake', 'refused');
    if (wanted) set('none');
    return current;
  }
  if (!wanted) {
    // release() arrived while the request was pending (shift closed, mode changed): the lock that
    // has just been granted must not outlive it.
    drop(s);
    return current;
  }
  sentinel = s;
  // The system releases the lock when the page is hidden; the session asks again on return.
  s.addEventListener('release', () => {
    if (sentinel === s) sentinel = null;
  });
  set('native');
  return current;
}

/**
 * Call inside the "Inizia turno" click, and again on every app:visible during a shift.
 * Resolves 'off' when release() was called before the system answered.
 * @returns {Promise<'off'|'native'|'none'>}
 */
export function acquire() {
  wanted = true;
  const wl = typeof navigator !== 'undefined' ? /** @type {any} */ (navigator).wakeLock : undefined;
  if (!wl) {
    set('none');
    return Promise.resolve(current);
  }
  if (sentinel && !sentinel.released) {
    set('native');
    return Promise.resolve(current);
  }
  // One request at a time: two overlapping ones would leave a lock nobody holds a handle to.
  if (!pending) {
    const job = request(wl);
    pending = job;
    const settled = () => {
      if (pending === job) pending = null;
    };
    job.then(settled, settled);
  }
  return pending;
}

export function release() {
  wanted = false;
  const s = sentinel;
  sentinel = null;
  drop(s);
  set('off');
}

/** @returns {'off'|'native'|'none'} */
export function mode() {
  return current;
}
