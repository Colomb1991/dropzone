// @ts-check
// Screen wake lock. No video fallback in Release 1: 'none' shows the Auto-Lock sheet and banner.
import * as store from '../store.js';
import * as log from '../log.js';

/** @type {any} */
let sentinel = null;
/** @type {'off'|'native'|'none'} */
let current = 'off';

function set(m) {
  current = m;
  store.setState({ wake: m });
}

/** Call inside the "Inizia turno" click, and again on every app:visible during a shift. */
export async function acquire() {
  const wl = typeof navigator !== 'undefined' ? /** @type {any} */ (navigator).wakeLock : undefined;
  if (!wl) {
    set('none');
    return /** @type {'none'} */ ('none');
  }
  try {
    if (!sentinel || sentinel.released) {
      sentinel = await wl.request('screen');
      // The system releases the lock when the page is hidden; the session asks again on return.
      sentinel.addEventListener('release', () => {
        sentinel = null;
      });
    }
    set('native');
  } catch (err) {
    log.warn('wake', 'refused');
    set('none');
  }
  return /** @type {'native'|'none'} */ (current);
}

export function release() {
  const s = sentinel;
  sentinel = null;
  if (s && !s.released) s.release().catch(() => log.warn('wake', 'release-failed'));
  set('off');
}

/** @returns {'off'|'native'|'none'} */
export function mode() {
  return current;
}
