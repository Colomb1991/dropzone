// @ts-check
// The only writer of user data. One database named after the URL scope; the demo uses '<scope>-demo'.
import * as events from '../events.js';
import * as store from '../store.js';
import * as log from '../log.js';
import * as env from '../env.js';
import { AppError } from '../errors.js';
import { DB_VERSION, allStores } from './schema.js';
import { openIdb, runTx, dumpIdb, deleteIdb } from './idb-backend.js';

/** @type {IDBDatabase|null} */
let conn = null;
let name = '';
/** @type {import('../types.js').StoreDef[]} */
let defs = [];

function mapError(err) {
  if (err instanceof AppError) return err;
  const n = /** @type {any} */ (err)?.name;
  if (n === 'QuotaExceededError') return new AppError('db-quota', 'core.err.quota', { cause: err });
  return new AppError('db-unavailable', 'core.err.save', { cause: err });
}

async function connect() {
  conn = await openIdb(name || env.dbName(), defs, DB_VERSION);
  conn.onversionchange = () => {
    conn?.close();
    conn = null;
    events.emit('db:outdated', {});
  };
}

/** @param {import('../types.js').StoreDef[]} [stores] default: schema.allStores() */
export async function openDb(stores) {
  defs = stores ?? (defs.length ? defs : allStores());
  name = name || env.dbName();
  try {
    await connect();
  } catch (err) {
    log.error('db', err);
    throw err instanceof AppError ? err : new AppError('db-upgrade', 'core.err.dbUpgrade', { cause: err });
  }
}

/** sandbox.js only: switch to another database (the demo). Call openDb() afterwards. */
export function useDatabase(dbName) {
  conn?.close();
  conn = null;
  name = dbName;
}

export function demoName() {
  return `${env.dbName()}-demo`;
}

/** Boot always deletes a leftover demo database. */
export function deleteDemoDatabase() {
  return deleteIdb(demoName());
}

/**
 * One transaction; inside `fn` await only `t.*` calls. Emits data:changed after commit.
 * @template T
 * @param {string[]} stores @param {'r'|'rw'} mode
 * @param {(t: import('../types.js').Tx) => Promise<T>} fn @returns {Promise<T>}
 */
export async function tx(stores, mode, fn) {
  let out;
  for (let attempt = 0; ; attempt++) {
    try {
      if (!conn) await connect();
      out = await runTx(conn, stores, mode, fn);
      break;
    } catch (err) {
      const n = /** @type {any} */ (err)?.name;
      // Retry once after reopening (ARCHITECTURE 2.3).
      if (attempt === 0 && (n === 'UnknownError' || n === 'InvalidStateError')) {
        conn?.close();
        conn = null;
        continue;
      }
      log.error('db', err);
      throw mapError(err);
    }
  }
  /** @type {Map<string, {store:string, op:string, keys:any[]}>} */
  const grouped = new Map();
  for (const c of out.changes) {
    const k = `${c.store}|${c.op}`;
    if (!grouped.has(k)) grouped.set(k, { store: c.store, op: c.op, keys: [] });
    if (c.key !== null) /** @type {any} */ (grouped.get(k)).keys.push(c.key);
  }
  for (const g of grouped.values()) events.emit('data:changed', g);
  return out.result;
}

export const get = (s, key) => tx([s], 'r', (t) => t.get(s, key));
/** @param {string} s @param {import('../types.js').Query} [q] @returns {Promise<any[]>} */
export const getAll = (s, q) => tx([s], 'r', (t) => t.getAll(s, q));
export const count = (s, q) => tx([s], 'r', (t) => t.count(s, q));
export const put = (s, rec) => tx([s], 'rw', (t) => t.put(s, rec));
export const del = (s, key) => tx([s], 'rw', (t) => t.del(s, key));
export const clear = (s) => tx([s], 'rw', (t) => t.clear(s));

/** One transaction. */
export function putMany(s, recs) {
  return tx([s], 'rw', async (t) => {
    for (const r of recs) await t.put(s, r);
  });
}

/** localStorage mirrors of theme and lang, read by theme-boot.js before first paint. */
export function setMirror(key, value) {
  try {
    if (value === null) localStorage.removeItem(env.mirrorKey(key));
    else localStorage.setItem(env.mirrorKey(key), value);
  } catch (err) {
    log.warn('db', 'mirror-failed');
  }
}

/**
 * Clears every store, the saved map tiles, sessionStorage and the mirrors; then reloads the page.
 * @param {{reload?:boolean}} [opts]
 */
export async function wipeAll(opts = {}) {
  const names = defs.map((d) => d.name);
  await tx(names, 'rw', async (t) => {
    for (const n of names) await t.clear(n);
  });
  await clearTiles();
  try {
    sessionStorage.clear();
  } catch (err) {
    log.warn('db', 'session-clear-failed');
  }
  setMirror('theme', null);
  setMirror('lang', null);
  events.emit('data:wiped', {});
  if (opts.reload !== false) env.reloadApp();
}

/** "Svuota la mappa salvata". @returns {Promise<boolean>} */
export async function clearTiles() {
  if (typeof caches === 'undefined') return false;
  try {
    return await caches.delete(env.cacheName('tiles'));
  } catch (err) {
    log.warn('db', 'tiles-clear-failed');
    return false;
  }
}

/** Works on any schema version; rescue export. */
export function dumpRaw() {
  conn?.close();
  conn = null;
  return dumpIdb(name || env.dbName());
}

/** @returns {Promise<{persisted:boolean|null, usage:number, quota:number, pct:number}>} */
export async function storageInfo() {
  const sm = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  let persisted = null;
  let usage = 0;
  let quota = 0;
  try {
    if (sm?.persisted) persisted = await sm.persisted();
    if (sm?.estimate) {
      const e = await sm.estimate();
      usage = e.usage ?? 0;
      quota = e.quota ?? 0;
    }
  } catch (err) {
    log.warn('db', 'estimate-failed');
  }
  const pct = quota > 0 ? Math.round((usage / quota) * 100) : 0;
  store.setState({ storage: { persisted, pct } });
  return { persisted, usage, quota, pct };
}

/** false where the API is missing. */
export async function requestPersist() {
  const sm = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!sm?.persist) return false;
  try {
    const ok = await sm.persist();
    store.setState({ storage: { ...store.getState().storage, persisted: ok } });
    return ok;
  } catch (err) {
    return false;
  }
}
