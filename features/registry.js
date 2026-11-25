// @ts-check
// The only place the app learns about features. Release 1: 12 folders, static list.
import turno from './turno/feature.js';
import ore from './ore/feature.js';
import sos from './sos/feature.js';
import note from './note/feature.js';
import segnala from './segnala/feature.js';
import zona from './zona/feature.js';
import vicino from './vicino/feature.js';
import impostazioni from './impostazioni/feature.js';
import benvenuto from './benvenuto/feature.js';
import legale from './legale/feature.js';
import demo from './demo/feature.js';
import furgone from './furgone/feature.js';
import { matchRoute } from '../core/pure/route-match.js';

export const FEATURE_IDS = ['turno', 'ore', 'sos', 'note', 'segnala', 'zona', 'vicino', 'impostazioni',
  'benvenuto', 'legale', 'demo', 'furgone'];

export const FEATURES = [turno, ore, sos, note, segnala, zona, vicino, impostazioni, benvenuto, legale,
  demo, furgone];

export const SLOT_NAMES = ['home.idle', 'home.tiles', 'home.shift', 'home.sticky', 'briefing', 'shift.end',
  'map.pins', 'diagnostics', 'data.counts', 'overlay'];

/**
 * Checks every manifest (ARCHITECTURE 5.2). Pure: also run by tests/audit.
 * @param {any[]} features @returns {string[]} problems, empty when all is well
 */
export function validateFeatures(features) {
  const problems = [];
  const ids = new Set();
  const paths = new Set();
  const stores = new Set();
  const keys = new Set();
  for (const f of features) {
    const id = String(f?.id ?? '');
    if (!FEATURE_IDS.includes(id)) problems.push(`unknown feature id "${id}"`);
    if (ids.has(id)) problems.push(`duplicate feature id "${id}"`);
    ids.add(id);
    if (typeof f?.i18n?.it !== 'function' || typeof f?.i18n?.en !== 'function') problems.push(`${id}: i18n loaders missing`);
    for (const r of f.routes ?? []) {
      if (typeof r.path !== 'string' || !(r.path.startsWith('/') || r.path === '@viewer')) problems.push(`${id}: bad route path`);
      if (paths.has(r.path)) problems.push(`${id}: duplicate route ${r.path}`);
      paths.add(r.path);
      if (typeof r.load !== 'function') problems.push(`${id}: route ${r.path} has no load()`);
      if (typeof r.titleKey !== 'string') problems.push(`${id}: route ${r.path} has no titleKey`);
    }
    for (const s of f.stores ?? []) {
      if (stores.has(s.name)) problems.push(`${id}: duplicate store ${s.name}`);
      stores.add(s.name);
    }
    for (const k of Object.keys(f.settingKeys ?? {})) {
      if (!k.startsWith(`${id}.`)) problems.push(`${id}: setting key ${k} needs the prefix "${id}."`);
      if (keys.has(k)) problems.push(`${id}: duplicate setting key ${k}`);
      keys.add(k);
    }
    for (const s of f.slots ?? []) {
      if (!SLOT_NAMES.includes(s.slot)) problems.push(`${id}: unknown slot ${s.slot}`);
      if (typeof s.load !== 'function' && typeof s.provide !== 'function') problems.push(`${id}: slot ${s.slot} is empty`);
    }
  }
  const patterns = [...paths].filter((p) => p.startsWith('/'));
  let tabs = 0;
  for (const f of features) {
    for (const n of f.nav ?? []) {
      if (n.place === 'tab') tabs++;
      if (!matchRoute(String(n.to), patterns)) problems.push(`${f.id}: nav.to ${n.to} matches no route`);
    }
  }
  if (tabs > 4) problems.push(`more than 4 tab entries (${tabs})`);
  return problems;
}
