// @ts-check
// Values live in the `settings` store as {key, value, updatedAt}; reads are synchronous from memory.
import * as db from './db/db.js';
import * as events from './events.js';
import { now } from './clock.js';
import { AppError } from './errors.js';
import { CORE_SETTINGS } from './settings-schema.js';
import { isValid, defaultOf, matchesKey, sanitize } from './pure/settings-core.js';

/** @type {Record<string, import('./pure/settings-core.js').SettingDef>} */
let defs = { ...CORE_SETTINGS };
/** @type {Record<string, any>} */
let values = {};

/** Boot: every feature's settingKeys. Core keys are always defined. */
export function defineSettings(more) {
  defs = { ...defs, ...more };
}

export function definitions() {
  return defs;
}

/** Reads all values into memory. Call after db.openDb and after sandbox.enter. */
export async function loadSettings() {
  values = sanitize(defs, await db.getAll('settings'));
}

/** Sync; the default when unset. @param {string} key */
export function get(key) {
  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : defaultOf(defs, key);
}

/** True when the user (or a restore) has stored a value for the key. */
export function isSet(key) {
  return Object.prototype.hasOwnProperty.call(values, key);
}

/** Validates → persists → emits settings:changed {key, value, prev}. */
export async function set(key, value) {
  if (!isValid(defs, key, value)) throw new AppError('setting-invalid', 'core.err.generic', { data: { key } });
  const prev = get(key);
  await db.put('settings', { key, value, updatedAt: now() });
  values[key] = value;
  if (defs[key].mirror) db.setMirror(key, String(value));
  events.emit('settings:changed', { key, value, prev });
}

/** @param {string} keyOrPrefix 'voice.on', or 'voice.' for a group, or '' for all */
export function onChange(keyOrPrefix, cb) {
  return events.on('settings:changed', (e) => {
    if (matchesKey(keyOrPrefix, e.key)) cb(e.value, e.key);
  });
}

export async function reset(key) {
  const prev = get(key);
  await db.del('settings', key);
  delete values[key];
  if (defs[key]?.mirror) db.setMirror(key, null);
  events.emit('settings:changed', { key, value: get(key), prev });
}
