// @ts-check
/** @typedef {{default:any, validate:(v:unknown)=>boolean, backup?:boolean, mirror?:boolean}} SettingDef */

export const oneOf = (...values) => (v) => values.includes(v);
export const isBool = (v) => typeof v === 'boolean';
export const numOrNull = (v) => v === null || (typeof v === 'number' && Number.isFinite(v));
export const strOrNull = (v) => v === null || (typeof v === 'string' && v.length <= 200);

/** @param {Record<string, SettingDef>} defs */
export function isValid(defs, key, value) {
  const def = defs[key];
  if (!def) return false;
  try {
    return def.validate(value) === true;
  } catch (err) {
    return false;
  }
}

/** Default of a key (cloned when it is an object); undefined for unknown keys. */
export function defaultOf(defs, key) {
  const def = defs[key];
  if (!def) return undefined;
  const d = def.default;
  return d && typeof d === 'object' ? JSON.parse(JSON.stringify(d)) : d;
}

/** A listener on 'voice.' hears 'voice.on'; a listener on 'voice.on' hears only that key. */
export function matchesKey(keyOrPrefix, key) {
  return keyOrPrefix === key || keyOrPrefix === '' || (keyOrPrefix.endsWith('.') && key.startsWith(keyOrPrefix));
}

/** Values read from storage: invalid or unknown ones are dropped. */
export function sanitize(defs, records) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const rec of records) {
    if (rec && isValid(defs, rec.key, rec.value)) out[rec.key] = rec.value;
  }
  return out;
}
