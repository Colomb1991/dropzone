// @ts-check
// The preview list of "Scansiona" and "Incolla": what was read from the box, what the courier ticked,
// corrected or removed, and what is left after a search. The box itself is never kept: only rows of
// addresses and points live here. Pure.
import { cleanLabel, QUERY_MAX } from './address.js';
import { extractAddresses } from './extract.js';

/**
 * @typedef {{id:string, kind:'address'|'coords', text:string, sub:string, checked:boolean, pinned:boolean,
 *   miss:boolean, townFrom:string, sender:boolean, lat:number, lon:number, label:string}} Row
 *   `pinned`: the row no longer comes from the box (corrected by hand, or left over by a search);
 *   `miss`: the last search did not find it; `sub`: postal code and province, when the text had them
 */

/** @param {import('./extract.js').AddressItem|import('./extract.js').CoordsItem} item @returns {Row} */
export function rowOf(item) {
  if (item.kind === 'coords') {
    return { id: item.id, kind: 'coords', text: `${item.lat}, ${item.lon}`, sub: item.label, checked: true,
      pinned: false, miss: false, townFrom: 'text', sender: false, lat: item.lat, lon: item.lon, label: item.label };
  }
  return { id: item.id, kind: 'address', text: item.text, sub: [item.cap, item.prov].filter(Boolean).join(' · '),
    // The address of the sender is shown, but not ticked: it is rarely a stop.
    checked: !item.sender, pinned: false, miss: false, townFrom: item.townFrom, sender: item.sender, lat: 0, lon: 0,
    label: '' };
}

/**
 * The rows after the box was read again: the pinned ones stay where they are, then one row per item
 * of the box, in its order. A row the courier already touched keeps its tick; an item the courier
 * removed or corrected (`hidden`) does not come back.
 * @param {Row[]} rows @param {(import('./extract.js').AddressItem|import('./extract.js').CoordsItem)[]} items
 * @param {Set<string>} hidden @returns {Row[]}
 */
export function syncRows(rows, items, hidden) {
  const pinned = rows.filter((r) => r.pinned);
  const taken = new Set(pinned.map((r) => r.id));
  const old = new Map(rows.filter((r) => !r.pinned).map((r) => [r.id, r]));
  const live = [];
  for (const item of items) {
    if (hidden.has(item.id) || taken.has(item.id)) continue;
    taken.add(item.id);
    const row = rowOf(item);
    const was = old.get(item.id);
    live.push(was ? { ...row, checked: was.checked } : row);
  }
  return [...pinned, ...live];
}

/** @param {Row[]} rows @param {string} id @returns {Row[]} */
export function toggleRow(rows, id) {
  return rows.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r));
}

/**
 * The text a correction leaves in a row: when it reads as an address it is written like one (and a
 * name typed with it is dropped), otherwise it is kept as the courier wrote it.
 * @param {string} text @param {{town?:string, towns?:string[]}} [opts] @returns {string}
 */
export function correctedText(text, opts = {}) {
  const found = extractAddresses(text, opts);
  return found.length === 1 ? found[0].text : cleanLabel(text, QUERY_MAX);
}

/**
 * A row corrected by hand. It is pinned, ticked, and no longer "not found"; the item of the box it
 * came from must be hidden by the caller (the returned `hide`).
 * @param {Row[]} rows @param {string} id @param {string} text @param {string} newId
 * @returns {{rows:Row[], hide:string|null}}
 */
export function editRow(rows, id, text, newId) {
  const row = rows.find((r) => r.id === id);
  if (!row || !text.trim()) return { rows, hide: null };
  const next = { ...row, id: row.pinned ? row.id : newId, text, sub: '', checked: true, pinned: true, miss: false,
    townFrom: 'text', sender: false };
  return { rows: rows.map((r) => (r.id === id ? next : r)), hide: row.pinned ? null : row.id };
}

/** @param {Row[]} rows @param {string} id @returns {{rows:Row[], hide:string|null}} */
export function removeRow(rows, id) {
  const row = rows.find((r) => r.id === id);
  return { rows: rows.filter((r) => r.id !== id), hide: row && !row.pinned ? row.id : null };
}

/** The ticked rows, as the items `resolveItems` looks for. @param {Row[]} rows */
export function rowsToItems(rows) {
  return rows.filter((r) => r.checked).map((r) => (r.kind === 'coords'
    ? { kind: /** @type {const} */ ('coords'), lat: r.lat, lon: r.lon, label: r.label }
    : { kind: /** @type {const} */ ('address'), text: r.text }));
}

/**
 * The rows left after a search: the ticked ones that were found are gone; the ones not found are
 * marked, the ones not tried (the courier stopped) and the unticked ones stay as they were. Every row
 * left is pinned: the box they came from has been emptied.
 * @param {Row[]} rows @param {{missingAt:number[], stoppedAt:number}} res indexes among the ticked rows
 * @returns {Row[]}
 */
export function rowsAfterSearch(rows, res) {
  const missing = new Set(res.missingAt);
  const out = [];
  let at = 0;
  for (const row of rows) {
    if (!row.checked) out.push({ ...row, pinned: true });
    else {
      if (missing.has(at)) out.push({ ...row, pinned: true, miss: true });
      else if (at >= res.stoppedAt) out.push({ ...row, pinned: true });
      at++;
    }
  }
  return out;
}

/**
 * The town of an address learned earlier, read from its label ("Via Roma 12, Livorno" → "Livorno"):
 * the towns the courier works in are recognised in a scan even without a postal code.
 * @param {{label:string}[]} points @returns {string[]}
 */
export function townsOf(points) {
  const out = new Set();
  for (const p of points) {
    const parts = String(p.label ?? '').split(',');
    const town = parts.length > 1 ? parts[parts.length - 1].trim() : '';
    if (town && !/\d/.test(town) && town.length <= 40) out.add(town);
  }
  return [...out];
}
