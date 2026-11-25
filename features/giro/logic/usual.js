// @ts-check
// "Abituali": the stops the courier has already made. The addresses whose door the phone has learned
// (counted at every "Fatto") and the stops done in the route that is still on the phone. Each one
// carries its point, so adding it again needs no network. Pure.
import { normalizeAddress } from './address.js';

/**
 * @typedef {{id:string, label:string, lat:number, lon:number, n:number, at:number, addr:string|null,
 *   src:import('./route.js').StopSource, learned:boolean, waiting:boolean}} Usual
 *   `n`: how many times it was done; `learned`: its door was measured by the phone; `waiting`: it is
 *   already in the route, still to do
 */

const words = (text) => normalizeAddress(text).split(' ').filter(Boolean);

/**
 * Most used first, then most recent.
 * @param {import('./address.js').DoorPoint[]} doorPoints
 * @param {import('./route.js').Route|null|undefined} route
 * @returns {Usual[]}
 */
export function usualStops(doorPoints, route) {
  const stops = route?.stops ?? [];
  const waiting = new Set(stops.filter((s) => !s.done && s.addr).map((s) => s.addr));
  /** @type {Usual[]} */
  const out = (doorPoints ?? []).map((p) => ({ id: `d:${p.key}`, label: p.label, lat: p.lat, lon: p.lon, n: p.n,
    at: p.updatedAt, addr: p.key, src: /** @type {const} */ ('door'), learned: true, waiting: waiting.has(p.key) }));
  const seen = new Set(out.map((u) => u.addr));
  for (const s of stops) {
    // A note is added from "Note"; a point without a label says nothing in a list.
    if (!s.done || s.src === 'note' || !s.label) continue;
    const same = s.addr ?? `@${s.lat},${s.lon}`;
    if (seen.has(same)) continue;
    seen.add(same);
    out.push({ id: `s:${s.id}`, label: s.label, lat: s.lat, lon: s.lon, n: 1, at: route?.updatedAt ?? 0, addr: s.addr,
      src: s.src, learned: false, waiting: Boolean(s.addr) && waiting.has(s.addr) });
  }
  return out.sort((a, b) => b.n - a.n || b.at - a.at || a.label.localeCompare(b.label));
}

/**
 * The stops whose label has every word typed; the last word may be only its beginning. Nothing
 * typed: all of them.
 * @param {Usual[]} list @param {string} text @returns {Usual[]}
 */
export function searchUsual(list, text) {
  const q = words(text);
  if (q.length === 0) return list;
  const last = q.length - 1;
  return list.filter((u) => {
    const k = words(u.label);
    return q.every((w, i) => (i === last ? k.some((x) => x.startsWith(w)) : k.includes(w)));
  });
}

/**
 * The chosen stops as inputs of `addStops`, in the order of the list.
 * @param {Usual[]} list @param {Set<string>} picked
 */
export function usualInputs(list, picked) {
  return list.filter((u) => picked.has(u.id)).map((u) => ({ lat: u.lat, lon: u.lon, label: u.label, src: u.src,
    addr: u.addr }));
}
