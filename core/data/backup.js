// @ts-check
// Backup: JSON Lines export and merge-only restore (SPEC 4.8, 7.5).
import * as db from '../db/db.js';
import * as events from '../events.js';
import * as settings from '../settings.js';
import * as log from '../log.js';
import { now } from '../clock.js';
import { AppError } from '../errors.js';
import { APP_VERSION } from '../../config/app.js';
import { DB_VERSION, allStores } from '../db/schema.js';
import { LIMITS } from '../pure/catalog.js';
import {
  backupHeader, backupFilename, encodeLine, decodeLine, validateHeader, upgradeRecord, mergeDecision,
} from '../pure/backup-format.js';

const CHUNK = 4 * 1024 * 1024;
const MEDIA_BATCH = 10;
const TRACKED = new Set(['notes', 'shifts', 'media', 'van', 'alerts']);

const backupDefs = () => allStores().filter((d) => d.backup !== 'never');
const settingInBackup = (key) => settings.definitions()[key] !== undefined && settings.definitions()[key].backup !== false;

/**
 * Builds the file. The caller shares or downloads it in a later tap, then calls markBackupDone().
 * @param {{includeVan:boolean}} opts @returns {Promise<File>}
 */
export async function prepareBackup(opts) {
  /** @type {string[]} */
  const lines = [];
  /** @type {Record<string, number>} */
  const counts = {};
  const defs = backupDefs();
  for (const def of defs.filter((d) => d.name !== 'media')) {
    let recs = await db.getAll(def.name);
    if (def.name === 'settings') recs = recs.filter((r) => settingInBackup(r.key));
    counts[def.name] = recs.length;
    for (const r of recs) lines.push(encodeLine(def.name, r));
  }
  let media = await db.getAll('media');
  if (!opts.includeVan) media = media.filter((m) => m.kind !== 'van');
  counts.media = media.length;
  for (const m of media) lines.push(encodeLine('media', m));
  const at = now();
  const header = JSON.stringify(backupHeader({ schema: DB_VERSION, appVersion: APP_VERSION, createdAt: at,
    includeVan: opts.includeVan === true, counts }));
  const parts = [`${header}\n`, ...lines.map((l) => `${l}\n`)];
  return new File(parts, backupFilename(new Date(at)), { type: 'text/plain' });
}

/** Call only after the file was shared ('shared') or downloaded. */
export function markBackupDone() {
  return settings.set('lastBackupAt', now());
}

/** Reads the file line by line in 4 MB pieces. */
async function eachLine(file, onLine) {
  const decoder = new TextDecoder('utf-8');
  let carry = '';
  let first = true;
  for (let pos = 0; pos < file.size; pos += CHUNK) {
    const buf = await file.slice(pos, pos + CHUNK).arrayBuffer();
    const text = carry + decoder.decode(buf, { stream: true });
    const rows = text.split('\n');
    carry = rows.pop() ?? '';
    for (const row of rows) {
      if ((await onLine(row, first)) === false) return;
      first = false;
    }
  }
  if (carry.trim() !== '') await onLine(carry, first);
}

function parseHeader(line) {
  try {
    return validateHeader(JSON.parse(line), DB_VERSION);
  } catch (err) {
    return /** @type {{ok:false, reason:'not-backup'}} */ ({ ok: false, reason: 'not-backup' });
  }
}

/**
 * @param {File} file
 * @returns {Promise<{ok:true, preview:{createdAt:number, appVersion:string, schema:number, vanMedia:boolean,
 *   counts:Record<string, number>}} | {ok:false, reason:'not-backup'|'too-new'|'too-big'}>}
 */
export async function previewBackup(file) {
  if (file.size > LIMITS.backupBytes) return { ok: false, reason: 'too-big' };
  /** @type {any} */
  let result = { ok: false, reason: 'not-backup' };
  await eachLine(file, (line) => {
    result = parseHeader(line);
    return false;
  });
  return result;
}

const ERR_KEYS = { 'not-backup': 'core.err.backupNot', 'too-new': 'core.err.backupNew', 'too-big': 'core.err.backupBig' };

/**
 * A shift that was running when the file was made: on a phone that does not have it, nothing would
 * ever close it (the active-shift pointer is not in the file). It ends where it was last seen.
 */
function closeOpenShift(s) {
  const endAt = Math.max(s.startAt, s.lastSeenAt);
  return { ...s, endAt, edited: true, breaks: s.breaks.map((b) => (b.endAt === null
    ? { ...b, endAt: Math.max(b.startAt, Math.min(b.startAt + b.plannedMin * 60000, endAt)), auto: true } : b)) };
}

/**
 * Merge only: adds what is missing, keeps the newer of two versions, fills settings never set.
 * Nothing on the phone is deleted. Interrupted: pick the file again.
 * @param {File} file @returns {Promise<{added:number, updated:number, skipped:number}>}
 */
export async function restoreBackup(file) {
  const head = await previewBackup(file);
  if (!head.ok) throw new AppError(`backup-${head.reason}`, ERR_KEYS[head.reason]);
  const schema = head.preview.schema;
  const defs = new Map(backupDefs().map((d) => [d.name, d]));
  const stats = { added: 0, updated: 0, skipped: 0 };
  /** @type {{s:string, r:any}[]} */
  const records = [];
  /** @type {any[]} */
  let mediaBatch = [];
  const keyOf = (s, r) => r[/** @type {any} */ (defs.get(s)).keyPath];
  const merge = async (t, s, r) => {
    const local = await t.get(s, keyOf(s, r));
    const what = mergeDecision(s, r, local);
    if (what === 'skip') stats.skipped++;
    else {
      await t.put(s, r);
      stats[what === 'add' ? 'added' : 'updated']++;
    }
  };
  const flushMedia = async () => {
    const batch = mediaBatch;
    mediaBatch = [];
    if (batch.length) await db.tx(['media'], 'rw', async (t) => {
      for (const m of batch) await merge(t, 'media', m);
    });
  };
  await eachLine(file, async (line, first) => {
    if (first) return true;
    const row = decodeLine(line);
    const def = row ? defs.get(row.s) : undefined;
    let rec = row && def ? upgradeRecord(def, row.r, schema, DB_VERSION) : null;
    if (row && rec && row.s === 'shifts' && /** @type {any} */ (rec).endAt === null) rec = closeOpenShift(rec);
    if (!row || !rec || (row.s === 'settings' && !settingInBackup(/** @type {any} */ (rec).key))) {
      if (line.trim() !== '') stats.skipped++;
      return true;
    }
    if (row.s === 'media') {
      mediaBatch.push(rec);
      if (mediaBatch.length >= MEDIA_BATCH) await flushMedia();
    } else {
      records.push({ s: row.s, r: rec });
    }
    return true;
  });
  const names = [...new Set(records.map((x) => x.s))];
  if (names.length) await db.tx(names, 'rw', async (t) => {
    for (const x of records) await merge(t, x.s, x.r);
  });
  await flushMedia();
  await settings.loadSettings();
  events.emit('data:restored', {});
  log.info('backup', 'restored', stats);
  return stats;
}

let tracking = false;

/** Boot: keeps `lastChangeAt` fresh (at most one write per 10 minutes) for the backup nudge. */
export function startChangeTracking() {
  if (tracking) return;
  tracking = true;
  events.on('data:changed', (e) => {
    // 'clear' is "Elimina tutto": writing the setting here would leave a record behind the wipe.
    if (!TRACKED.has(e.store) || e.remote || e.op === 'clear') return;
    const last = settings.get('lastChangeAt');
    if (last !== null && now() - last < 600000) return;
    settings.set('lastChangeAt', now()).catch((err) => log.error('backup', err));
  });
}

/** True when the weekly nudge applies: data changed and no backup for over 7 days. */
export function backupDue() {
  const changed = settings.get('lastChangeAt');
  const last = settings.get('lastBackupAt');
  if (changed === null) return false;
  if (last === null) return now() - (settings.get('onboardedAt') ?? changed) > 7 * 86400000;
  return changed > last && now() - last > 7 * 86400000;
}
