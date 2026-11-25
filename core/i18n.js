// @ts-check
import * as events from './events.js';
import * as store from './store.js';
import * as log from './log.js';
import * as settings from './settings.js';
import { interpolate, pickPlural, resolve, splitRich } from './pure/i18n-core.js';

/** @typedef {import('./pure/i18n-core.js').Dict} Dict */
/** @typedef {{it:()=>Promise<{default:Dict}>, en:()=>Promise<{default:Dict}>}} Loader */

/** Core and kit strings (keys `core.*`). Always loaded first. */
export const coreLoader = { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') };

/** @type {Loader[]} */
let loaders = [coreLoader];
/** @type {'it'|'en'} */
let lang = 'it';
/** @type {Dict} */
let cur = {};
/** @type {Dict} */
let fallback = {};
const missing = new Set();

async function loadLang(l) {
  const mods = await Promise.all(loaders.map((x) => x[l]()));
  return Object.assign({}, ...mods.map((m) => m.default));
}

function apply() {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  store.setState({ lang });
}

/** Loads the active language and `it` (the fallback). @param {'it'|'en'} l @param {Loader[]} [more] */
export async function initI18n(l, more = []) {
  loaders = [coreLoader, ...more.filter((x) => x && x !== coreLoader)];
  fallback = await loadLang('it');
  cur = l === 'en' ? await loadLang('en') : fallback;
  lang = l === 'en' ? 'en' : 'it';
  apply();
}

function entry(key) {
  const e = resolve({ cur, fallback }, key);
  if (e === undefined && !missing.has(key)) {
    missing.add(key);
    log.warn('i18n', 'missing', { key });
  }
  return e;
}

/** @param {string} key @param {Record<string, string|number>} [params] @returns {string} */
export function t(key, params) {
  const e = entry(key);
  if (e === undefined) return key;
  return interpolate(typeof e === 'string' ? e : e.other, params);
}

/** Plural; {n} = count formatted for the locale. */
export function tn(key, count, params) {
  const e = entry(key);
  if (e === undefined) return key;
  const n = new Intl.NumberFormat(locale()).format(count);
  return interpolate(pickPlural(e, count, locale()), { n, ...params });
}

/** "[[terms|Termini]]" → slots.terms('Termini'); plain parts stay strings. */
export function tRich(key, slots) {
  return splitRich(t(key)).map((p) => ('slot' in p && slots[p.slot] ? slots[p.slot](p.text) : p.text));
}

/** @returns {'it'|'en'} */
export function getLang() {
  return lang;
}

/** 'it-IT' or 'en-GB' (24 h clock, day-month order). */
export function locale() {
  return lang === 'en' ? 'en-GB' : 'it-IT';
}

/** Loads the dictionaries, sets <html lang>, stores the setting, emits lang:changed. */
export async function setLang(l) {
  const next = l === 'en' ? 'en' : 'it';
  cur = next === 'en' ? await loadLang('en') : fallback;
  lang = next;
  apply();
  if (settings.get('lang') !== next) await settings.set('lang', next);
  events.emit('lang:changed', { lang });
}
