// @ts-check
// Single-instance guard: one primary window per scope (Web Locks). Other windows show the banner
// and only `open` routes; their writes reach the primary through a BroadcastChannel.
import * as store from '../store.js';
import * as events from '../events.js';
import * as env from '../env.js';
import * as log from '../log.js';

let primary = true;
let claimed = null;
/** @type {BroadcastChannel|null} */
let channel = null;

/** @returns {Promise<boolean>} true when this window is the primary (also where the API is missing) */
export function claimPrimary() {
  if (claimed) return claimed;
  claimed = new Promise((resolve) => {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!locks?.request) {
      resolve(true);
      return;
    }
    locks.request(env.lockName(), { ifAvailable: true }, (lock) => {
      resolve(lock !== null);
      // Hold the lock for the life of the page.
      return lock ? new Promise(() => {}) : undefined;
    }).catch(() => resolve(true));
  }).then((ok) => {
    primary = ok;
    store.setState({ primary: ok });
    openChannel();
    return ok;
  });
  return claimed;
}

export function isPrimary() {
  return primary;
}

function openChannel() {
  if (channel || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel(env.channelName());
  channel.onmessage = (e) => {
    const m = e.data;
    if (primary && m?.type === 'data:changed') events.emit('data:changed', { ...m.payload, remote: true });
  };
  events.on('data:changed', (p) => {
    if (primary || p.remote) return;
    try {
      channel?.postMessage({ type: 'data:changed', payload: { store: p.store, op: p.op, keys: p.keys } });
    } catch (err) {
      log.warn('instance', 'post-failed');
    }
  });
}
