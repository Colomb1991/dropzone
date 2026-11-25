// @ts-check
// Ordering on the device: nearest neighbour from the start, then 2-opt, on straight-line distances.
// Pure: no clock, no storage. A route is an open path (the courier does not come back to the start).
import { distM } from '../../../core/pure/geo-math.js';

/** @typedef {{lat:number, lon:number}} Point */

const MAX_PASSES = 40;
// Below half a metre a swap is noise, and without the threshold rounding errors could loop.
const MIN_GAIN_M = 0.5;

/**
 * Length in metres of start → points[0] → points[1] → … (no return leg).
 * @param {Point|null} start @param {Point[]} points
 */
export function pathLengthM(start, points) {
  let total = 0;
  let prev = start;
  for (const p of points) {
    if (prev) total += distM(prev.lat, prev.lon, p.lat, p.lon);
    prev = p;
  }
  return total;
}

function matrix(nodes) {
  const n = nodes.length;
  const d = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      d[i][j] = d[j][i] = distM(nodes[i].lat, nodes[i].lon, nodes[j].lat, nodes[j].lon);
    }
  }
  return d;
}

/**
 * Nearest neighbour over a distance matrix; node 0 is the fixed first node.
 * @param {Float64Array[]} d @returns {number[]} node indexes, starting with 0
 */
export function nearestNeighbour(d) {
  const n = d.length;
  const path = n ? [0] : [];
  const left = new Set(Array.from({ length: Math.max(0, n - 1) }, (_, i) => i + 1));
  while (left.size) {
    const from = path[path.length - 1];
    let best = -1;
    for (const k of left) if (best === -1 || d[from][k] < d[from][best]) best = k;
    path.push(best);
    left.delete(best);
  }
  return path;
}

/**
 * 2-opt on an open path whose first node stays first: reverses a stretch whenever that shortens the path.
 * @param {number[]} path @param {Float64Array[]} d @returns {number[]} a new path
 */
export function twoOpt(path, d) {
  const p = [...path];
  const n = p.length;
  for (let pass = 0, improved = true; improved && pass < MAX_PASSES; pass++) {
    improved = false;
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const before = d[p[i - 1]][p[i]] + (j + 1 < n ? d[p[j]][p[j + 1]] : 0);
        const after = d[p[i - 1]][p[j]] + (j + 1 < n ? d[p[i]][p[j + 1]] : 0);
        if (before - after > MIN_GAIN_M) {
          for (let a = i, b = j; a < b; a++, b--) [p[a], p[b]] = [p[b], p[a]];
          improved = true;
        }
      }
    }
  }
  return p;
}

/**
 * Visiting order of the stops, starting from `start` (the current position). Without a start the
 * first stop stays first and the others are ordered after it.
 * @template {Point} T
 * @param {Point|null} start @param {T[]} stops @returns {T[]} the same objects, reordered
 */
export function orderStops(start, stops) {
  if (stops.length < 2 || (!start && stops.length < 3)) return [...stops];
  const nodes = start ? [start, ...stops] : stops;
  const d = matrix(nodes);
  const path = twoOpt(nearestNeighbour(d), d);
  return /** @type {T[]} */ ((start ? path.slice(1) : path).map((i) => nodes[i]));
}
