// @ts-check
// IndexedDB plumbing. The native version is schema × 1000 + n: n grows when a store is added
// without a schema bump (allowed before the first public deploy), so opening never fails on it.
import { AppError } from '../errors.js';

const req = (r) => new Promise((res, rej) => {
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});

function openRaw(name, version, onUpgrade) {
  return new Promise((resolve, reject) => {
    const r = version ? indexedDB.open(name, version) : indexedDB.open(name);
    r.onupgradeneeded = (e) => {
      try {
        if (onUpgrade) onUpgrade(r.result, /** @type {IDBTransaction} */ (r.transaction), e.oldVersion);
      } catch (err) {
        /** @type {IDBTransaction} */ (r.transaction).abort();
        reject(err);
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new AppError('db-blocked', 'core.err.dbUpdated'));
  });
}

function createStore(db, def) {
  const os = db.createObjectStore(def.name, { keyPath: def.keyPath, autoIncrement: def.autoIncrement === true });
  for (const ix of def.indexes ?? []) os.createIndex(ix.name, ix.keyPath, { unique: ix.unique === true });
}

function migrate(tx, def, v) {
  const os = tx.objectStore(def.name);
  const cur = os.openCursor();
  cur.onsuccess = () => {
    const c = cur.result;
    if (!c) return;
    const next = def.upgrades[v](c.value);
    if (next === null) c.delete();
    else c.update(next);
    c.continue();
  };
}

/**
 * Opens and upgrades. Any failure inside the upgrade aborts it: the database keeps its old version.
 * @param {string} name @param {import('../types.js').StoreDef[]} defs @param {number} schema
 * @returns {Promise<IDBDatabase>}
 */
export async function openIdb(name, defs, schema) {
  const probe = await openRaw(name, 0, null);
  const native = probe.version;
  const have = new Set(Array.from(probe.objectStoreNames));
  probe.close();
  const oldSchema = native >= 1000 ? Math.floor(native / 1000) : 0;
  if (oldSchema > schema) throw new AppError('db-too-new', 'core.err.dbUpdated');
  const missing = defs.filter((d) => !have.has(d.name) && d.since <= schema);
  let target = native;
  if (oldSchema < schema) target = schema * 1000;
  else if (missing.length) target = native + 1;
  return openRaw(name, target, (db, tx) => {
    for (const d of missing) createStore(db, d);
    for (let v = oldSchema + 1; v <= schema; v++) {
      for (const d of defs) {
        if (d.upgrades?.[v] && have.has(d.name)) migrate(tx, d, v);
      }
    }
  });
}

function range(q) {
  if (q.eq !== undefined) return IDBKeyRange.only(q.eq);
  if (q.from !== undefined && q.to !== undefined) return IDBKeyRange.bound(q.from, q.to);
  if (q.from !== undefined) return IDBKeyRange.lowerBound(q.from);
  if (q.to !== undefined) return IDBKeyRange.upperBound(q.to);
  return null;
}

function readAll(os, q = {}) {
  const src = q.index ? os.index(q.index) : os;
  if (!q.reverse) return req(src.getAll(range(q), q.limit));
  return new Promise((res, rej) => {
    const out = [];
    const c = src.openCursor(range(q), 'prev');
    c.onerror = () => rej(c.error);
    c.onsuccess = () => {
      const cur = c.result;
      if (!cur || (q.limit && out.length >= q.limit)) res(out);
      else {
        out.push(cur.value);
        cur.continue();
      }
    };
  });
}

/**
 * Runs `fn` in one transaction. Inside it await only `t.*` calls.
 * @returns {Promise<{result:any, changes:{store:string, op:'put'|'del'|'clear', key:any}[]}>}
 */
export function runTx(db, names, mode, fn) {
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(names, mode === 'rw' ? 'readwrite' : 'readonly');
    } catch (err) {
      reject(err);
      return;
    }
    let done = false;
    let result;
    let failed = null;
    const changes = [];
    const os = (store) => {
      if (done) throw new AppError('db-tx-leak');
      return tx.objectStore(store);
    };
    /** @type {import('../types.js').Tx} */
    const t = {
      get: (store, key) => req(os(store).get(key)),
      getAll: (store, q) => readAll(os(store), q),
      count: (store, q = {}) => req((q.index ? os(store).index(q.index) : os(store)).count(range(q))),
      put: async (store, rec) => {
        const key = await req(os(store).put(rec));
        changes.push({ store, op: 'put', key });
        return key;
      },
      del: async (store, key) => {
        await req(os(store).delete(key));
        changes.push({ store, op: 'del', key });
      },
      clear: async (store) => {
        await req(os(store).clear());
        changes.push({ store, op: 'clear', key: null });
      },
    };
    tx.oncomplete = () => {
      done = true;
      if (failed) reject(failed);
      else resolve({ result, changes });
    };
    tx.onabort = () => {
      done = true;
      reject(failed ?? tx.error ?? new AppError('db-abort', 'core.err.save'));
    };
    Promise.resolve().then(() => fn(t)).then((r) => {
      result = r;
    }, (err) => {
      failed = err;
      if (!done) {
        try {
          tx.abort();
        } catch (abortErr) {
          reject(err);
        }
      }
    });
  });
}

/** Every record of every store, whatever the schema version (rescue export). */
export async function dumpIdb(name) {
  const db = await openRaw(name, 0, null);
  /** @type {Record<string, object[]>} */
  const out = {};
  try {
    for (const store of Array.from(db.objectStoreNames)) {
      out[store] = await req(db.transaction(store, 'readonly').objectStore(store).getAll());
    }
  } finally {
    db.close();
  }
  return out;
}

export function deleteIdb(name) {
  return new Promise((resolve) => {
    const r = indexedDB.deleteDatabase(name);
    r.onsuccess = r.onerror = r.onblocked = () => resolve(undefined);
  });
}
