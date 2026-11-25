// @ts-check
// Real dependencies of loadCells (DECISIONS 11): poiCells cache → regional pack → Overpass.
import { db, gateway, clock, log } from '../../../core/api.js';
import { loadCells, cellsFor, packCellName } from './poi.js';

const PACK_DIR = 'assets/packs/toscana';
/** Fetched once per session. @type {Promise<{at:number, cells:Set<string>}|null>|null} */
let indexJob = null;

function packIndex() {
  indexJob ??= gateway.local(`${PACK_DIR}/index.json`, { as: 'json' }).then((idx) => {
    const at = Date.parse(idx?.generatedAt);
    if (!Number.isFinite(at) || !Array.isArray(idx?.cells)) return null;
    return { at, cells: new Set(idx.cells) };
  }, (err) => {
    log.warn('vicino', 'pack-index', { code: String(err?.code ?? '') });
    // Offline at first use: try again on the next load.
    indexJob = null;
    return null;
  });
  return indexJob;
}

/**
 * @param {{lat:number, lon:number}} here
 * @param {(rec:{cellId:string, fetchedAt:number, items:any[], src:string}) => void} onCell
 * @returns {Promise<{loaded:number, missing:number, failed:number, service:{allowed:boolean, reason:string}}>}
 */
export async function loadAround(here, onCell) {
  const service = gateway.serviceState('overpass');
  const result = await loadCells(cellsFor(here.lat, here.lon), {
    now: clock.now,
    canFetch: () => gateway.serviceState('overpass').allowed,
    getCell: (id) => db.get('poiCells', id),
    putCell: (rec) => db.put('poiCells', rec),
    packIndex,
    packCell: async (id) => (await gateway.local(`${PACK_DIR}/cells/${packCellName(id)}.json`, { as: 'json' })).elements,
    fetchCell: async (id) => (await gateway.overpassCell(id)).elements,
    onCell,
  });
  return { ...result, service };
}
