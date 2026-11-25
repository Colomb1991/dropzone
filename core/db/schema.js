// @ts-check
import {
  validateSettingRecord, validateKv, validateNote, validateMedia, validateNoteState, validateShift,
} from '../pure/validators.js';

/** Bump when a store changes after the first public deploy (plus `since` / `upgrades` in its owner). */
export const DB_VERSION = 1;

/** @typedef {import('../types.js').StoreDef} StoreDef */

/** @type {StoreDef[]} */
let featureStores = [];

/** Stores shared across features. `alerts`, `van`, `poiCells`, `imports` are declared by features. */
export function coreStores() {
  return [
    { name: 'settings', keyPath: 'key', since: 1, backup: 'always', validate: validateSettingRecord },
    { name: 'kv', keyPath: 'key', since: 1, backup: 'never', validate: validateKv },
    { name: 'notes', keyPath: 'id', since: 1, backup: 'always', validate: validateNote,
      indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }, { name: 'cat', keyPath: 'cat' },
        { name: 'importId', keyPath: 'importId' }] },
    { name: 'media', keyPath: 'id', since: 1, backup: 'always', validate: validateMedia,
      indexes: [{ name: 'kind', keyPath: 'kind' }, { name: 'createdAt', keyPath: 'createdAt' }] },
    { name: 'noteState', keyPath: 'noteId', since: 1, backup: 'always', validate: validateNoteState },
    { name: 'shifts', keyPath: 'id', since: 1, backup: 'always', validate: validateShift,
      indexes: [{ name: 'startAt', keyPath: 'startAt' }] },
  ];
}

/** Boot: every feature manifest's `stores`. */
export function registerStores(defs) {
  const known = new Set([...coreStores(), ...featureStores].map((s) => s.name));
  for (const d of defs ?? []) {
    if (!known.has(d.name)) {
      featureStores.push(d);
      known.add(d.name);
    }
  }
}

/** Core + every registered feature store. */
export function allStores() {
  return [...coreStores(), ...featureStores];
}
