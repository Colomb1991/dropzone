// @ts-check
// Near me (SPEC 6.8): cells, compact places, chips, tags, and the loading order of DECISIONS 11.
import { distM, M_PER_DEG_LAT } from '../../../core/pure/geo-math.js';

export const CELL_DEG = 0.05;
export const NEIGHBOUR_M = 1500;
export const MAX_CELLS = 4;
export const LIST_LIMIT = 20;
export const CACHE_FRESH_MS = 7 * 86400000;
export const PACK_FRESH_MS = 30 * 86400000;
const DAY_MS = 86400000;

export const CHIPS = /** @type {const} */ (
  ['miei', 'bagni', 'acqua', 'carburante', 'bar', 'supermercati', 'farmacie']);
export const CHIP_ICONS = {
  miei: 'star', bagni: 'toilet', acqua: 'droplet', carburante: 'fuel', bar: 'coffee',
  supermercati: 'shopping-cart', farmacie: 'pill',
};
const KINDS = ['toilets', 'drinking_water', 'fuel', 'cafe', 'bar', 'pharmacy', 'fast_food', 'supermarket', 'mall'];
const CHIP_KINDS = {
  bagni: ['toilets'], acqua: ['drinking_water'], carburante: ['fuel'], bar: ['cafe', 'bar'],
  supermercati: ['supermarket', 'mall'], farmacie: ['pharmacy'],
};
const TOILET_LIKELY = ['fuel', 'fast_food', 'supermarket', 'mall'];

/** @typedef {{id:string, lat:number, lon:number, kind:string, name:string, fee:boolean, customers:boolean,
 *   hours:string}} Poi */

/** Same id as the gateway: `${floor(lat / 0.05)}:${floor(lon / 0.05)}`. */
export function cellIdOf(lat, lon) {
  return `${Math.floor(lat / CELL_DEG)}:${Math.floor(lon / CELL_DEG)}`;
}

/** Pack file name of a cell: ':' becomes '_'. */
export function packCellName(cellId) {
  return cellId.replace(':', '_');
}

/**
 * The cell the user is in, plus each neighbour whose edge is within 1.5 km (at most 4, nearest first).
 * @returns {string[]}
 */
export function cellsFor(lat, lon) {
  const a = Math.floor(lat / CELL_DEG);
  const b = Math.floor(lon / CELL_DEG);
  const mLon = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  const south = (lat - a * CELL_DEG) * M_PER_DEG_LAT;
  const north = ((a + 1) * CELL_DEG - lat) * M_PER_DEG_LAT;
  const west = (lon - b * CELL_DEG) * mLon;
  const east = ((b + 1) * CELL_DEG - lon) * mLon;
  const dy = south <= north ? { step: -1, d: south } : { step: 1, d: north };
  const dx = west <= east ? { step: -1, d: west } : { step: 1, d: east };
  const out = [{ id: `${a}:${b}`, d: 0 }];
  if (dy.d <= NEIGHBOUR_M) out.push({ id: `${a + dy.step}:${b}`, d: dy.d });
  if (dx.d <= NEIGHBOUR_M) out.push({ id: `${a}:${b + dx.step}`, d: dx.d });
  const corner = Math.hypot(dx.d, dy.d);
  if (corner <= NEIGHBOUR_M) out.push({ id: `${a + dy.step}:${b + dx.step}`, d: corner });
  return out.sort((p, q) => p.d - q.d).slice(0, MAX_CELLS).map((c) => c.id);
}

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim().slice(0, max) : '');

/** Overpass `out center tags` elements → compact places. Unknown kinds and broken elements are dropped. */
export function normalizeElements(elements) {
  /** @type {Poi[]} */
  const out = [];
  for (const el of Array.isArray(elements) ? elements : []) {
    if (el === null || typeof el !== 'object') continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const tags = el.tags ?? {};
    const kind = KINDS.includes(tags.amenity) ? tags.amenity : (KINDS.includes(tags.shop) ? tags.shop : null);
    if (!kind || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    out.push({
      id: `${String(el.type ?? 'n').charAt(0)}${el.id}`, lat, lon, kind,
      name: str(tags.name, 60) || str(tags.brand, 60) || str(tags.operator, 60),
      fee: tags.fee === 'yes', customers: tags.access === 'customers', hours: str(tags.opening_hours, 80),
    });
  }
  return out;
}

/**
 * Nearest places of a chip. "Bagni": public toilets first, then places that probably have one.
 * @param {string} chip @param {Poi[]} items @param {{lat:number, lon:number}} here @param {number} [limit]
 * @returns {(Poi & {distM:number, likely:boolean})[]}
 */
export function itemsForChip(chip, items, here, limit = LIST_LIMIT) {
  const kinds = CHIP_KINDS[chip];
  if (!kinds) return [];
  const seen = new Set();
  const pick = (list, likely) => items
    .filter((p) => list.includes(p.kind) && !seen.has(p.id) && seen.add(p.id))
    .map((p) => ({ ...p, distM: distM(here.lat, here.lon, p.lat, p.lon), likely }))
    .sort((p, q) => p.distM - q.distM);
  const main = pick(kinds, false);
  const extra = chip === 'bagni' ? pick(TOILET_LIKELY, true) : [];
  return [...main, ...extra].slice(0, limit);
}

/** Own notes of category `bagno`, nearest first. */
export function ownSpots(notes, here) {
  return notes.filter((n) => n.cat === 'bagno')
    .map((n) => ({ note: n, distM: here ? distM(here.lat, here.lon, n.lat, n.lon) : null }))
    .sort((p, q) => (p.distM ?? 0) - (q.distM ?? 0) || q.note.updatedAt - p.note.updatedAt);
}

/**
 * Opening hours as written in OSM, with day names translated. No open/closed computation.
 * @param {string} raw @param {{always:string, days:Record<string,string>}} words
 */
export function hoursLabel(raw, words) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (s === '24/7') return words.always;
  return s.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH|off)\b/g, (m) => words.days[m] ?? m);
}

/** Whole days since the data was fetched. */
export function ageDays(fetchedAt, now) {
  return Math.max(0, Math.floor((now - fetchedAt) / DAY_MS));
}

/**
 * Loading order of one cell (DECISIONS 11): own cache younger than 7 days, then the pack, then Overpass.
 * A pack copy is refreshed from the network only when the pack is older than 30 days.
 * @param {{cachedAt:number|null, packAt:number|null, now:number, canFetch:boolean}} p
 * @returns {{use:'cache'|'pack'|'none', refresh:boolean}}
 */
export function planCell({ cachedAt, packAt, now, canFetch }) {
  if (cachedAt !== null && now - cachedAt < CACHE_FRESH_MS) return { use: 'cache', refresh: false };
  if (packAt !== null && (cachedAt === null || cachedAt <= packAt)) {
    return { use: cachedAt === packAt ? 'cache' : 'pack', refresh: canFetch && now - packAt > PACK_FRESH_MS };
  }
  return { use: cachedAt === null ? 'none' : 'cache', refresh: canFetch };
}

/** `poiCells` store record. @returns {object|null} */
export function validateCell(rec) {
  if (rec === null || typeof rec !== 'object' || !/^-?\d+:-?\d+$/.test(rec.cellId)) return null;
  if (!(rec.fetchedAt > 0) || !Array.isArray(rec.items)) return null;
  return { cellId: rec.cellId, fetchedAt: rec.fetchedAt, items: rec.items, src: rec.src === 'pack' ? 'pack' : 'net' };
}

/**
 * Loads the cells in the documented order. Every step that yields data calls `onCell` at once, so a
 * cached cell shows before the network answers.
 * @param {string[]} cellIds
 * @param {{now:()=>number, canFetch:()=>boolean, getCell:(id:string)=>Promise<any>,
 *   putCell:(rec:object)=>Promise<void>, packIndex:()=>Promise<{at:number, cells:Set<string>}|null>,
 *   packCell:(id:string)=>Promise<object[]>, fetchCell:(id:string)=>Promise<object[]>,
 *   onCell:(rec:{cellId:string, fetchedAt:number, items:Poi[], src:string})=>void}} deps
 * @returns {Promise<{loaded:number, missing:number, failed:number}>} failed = a network refresh was tried and lost
 */
export async function loadCells(cellIds, deps) {
  const result = { loaded: 0, missing: 0, failed: 0 };
  await Promise.all(cellIds.map(async (cellId) => {
    let have = false;
    const show = (rec) => {
      have = true;
      deps.onCell(rec);
    };
    const cached = await deps.getCell(cellId).catch(() => null);
    if (cached) show(cached);
    const fresh = cached && deps.now() - cached.fetchedAt < CACHE_FRESH_MS;
    const pack = fresh ? null : await deps.packIndex().catch(() => null);
    const packAt = pack && pack.cells.has(packCellName(cellId)) ? pack.at : null;
    const plan = planCell({ cachedAt: cached?.fetchedAt ?? null, packAt, now: deps.now(), canFetch: deps.canFetch() });
    if (plan.use === 'pack' && packAt !== null) {
      try {
        const rec = { cellId, fetchedAt: packAt, items: normalizeElements(await deps.packCell(cellId)), src: 'pack' };
        await deps.putCell(rec).catch(() => undefined);
        show(rec);
      } catch (err) {
        // A missing pack file is not fatal: the network is the next step.
        plan.refresh = deps.canFetch();
      }
    }
    if (plan.refresh) {
      try {
        const rec = { cellId, fetchedAt: deps.now(), items: normalizeElements(await deps.fetchCell(cellId)), src: 'net' };
        await deps.putCell(rec).catch(() => undefined);
        show(rec);
      } catch (err) {
        result.failed++;
      }
    }
    if (have) result.loaded++;
    else result.missing++;
  }));
  return result;
}
