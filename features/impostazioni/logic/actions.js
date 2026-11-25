// @ts-check
// Side effects shared by the settings screens: saving a backup file, reading sizes and counts.
import {
  t, settings, i18n, db, env, log, errors, share, backup, speech, slots, store,
} from '../../../core/api.js';
import { toast } from '../../../ui/kit/index.js';
import { vanBytes } from './options.js';

/** A read that may fail (private mode, broken storage) falls back to a default and is noted in the log. */
export function safe(promise, fallback) {
  return Promise.resolve(promise).catch((err) => {
    log.warn('impostazioni', 'read-failed', { code: String(err?.code ?? err?.name ?? '') });
    return fallback;
  });
}

/** Stores a setting; a refusal is shown as a toast. */
export function put(key, value) {
  return settings.set(key, value).catch((err) => {
    log.error('impostazioni', err, { key });
    toast(t(errors.toUserKey(err)), { icon: 'triangle-alert' });
  });
}

/**
 * Prepare, then tap: call as the first statement of the click handler, with a file built earlier.
 * `lastBackupAt` moves only after a share or a download.
 * @param {File} file @returns {Promise<'shared'|'downloaded'|'cancelled'|'sandbox'>}
 */
export function saveBackupFile(file) {
  const done = (how) => backup.markBackupDone().then(() => how, (err) => {
    log.error('backup', err);
    return how;
  });
  if (store.getState().sandbox) return Promise.resolve(/** @type {'sandbox'} */ ('sandbox'));
  // No file sharing on this phone: the download starts inside the same tap.
  if (!share.canShareFiles([file])) {
    share.downloadFile(file);
    return done(/** @type {'downloaded'} */ ('downloaded'));
  }
  return share.shareFiles([file]).then((res) => {
    if (res === 'shared') return done(/** @type {'shared'} */ ('shared'));
    if (res === 'unsupported') {
      share.downloadFile(file);
      return done(/** @type {'downloaded'} */ ('downloaded'));
    }
    return /** @type {'cancelled'} */ ('cancelled');
  });
}

/** Toast for the outcome of saveBackupFile. */
export function toastSaved(how) {
  if (how === 'shared') toast(t('impostazioni.bk.saved'), { icon: 'check' });
  else if (how === 'downloaded') toast(t('impostazioni.bk.downloaded'), { icon: 'download' });
  else if (how === 'sandbox') toast(t('core.nav.sandbox'));
}

/** Saved map tiles: entries and bytes (bytes only where the tile host exposes the length). */
export async function tileCacheInfo() {
  if (typeof caches === 'undefined') return { count: 0, bytes: 0 };
  try {
    const name = env.cacheName('tiles');
    if (!(await caches.has(name))) return { count: 0, bytes: 0 };
    const cache = await caches.open(name);
    const list = await cache.matchAll();
    let bytes = 0;
    for (const res of list) {
      const len = Number(res.headers.get('content-length'));
      bytes += Number.isFinite(len) && len > 0 ? len : 0;
    }
    // Opaque answers hide their size: assume 25 kB a tile so the row never claims "0 MB" for a full cache.
    return { count: list.length, bytes: bytes > 0 ? bytes : list.length * 25000 };
  } catch (err) {
    log.warn('impostazioni', 'tiles-size-failed');
    return { count: 0, bytes: 0 };
  }
}

/** Bytes of the van photos, from the diary records. */
export async function vanUsage() {
  return vanBytes(await safe(db.getAll('van'), []));
}

/**
 * Numbers of the delete dialog: notes, shifts, photos, plus what other features report.
 * @returns {Promise<{notes:number, shifts:number, photos:number, extra:{labelKey:string, count:number}[]}>}
 */
export async function loadCounts() {
  const [notes, shifts, photos, extra] = await Promise.all([
    safe(db.count('notes'), 0), safe(db.count('shifts'), 0), safe(db.count('media'), 0),
    safe(slots.collect('data.counts', {}), []),
  ]);
  // The notes are already in the sentence of the dialog: their own row would say them twice.
  const rows = /** @type {any[]} */ (extra).filter((r) => r && typeof r.labelKey === 'string' && r.count > 0
    && r.featureId !== 'note');
  return { notes, shifts, photos, extra: rows };
}

/** After a restore: mirrored settings reach the page (theme, language), the voice state is re-read. */
export async function afterRestore() {
  for (const key of ['theme', 'lang']) {
    if (settings.isSet(key)) await settings.set(key, settings.get(key));
  }
  if (settings.get('lang') !== i18n.getLang()) await i18n.setLang(settings.get('lang'));
  speech.refresh();
}
