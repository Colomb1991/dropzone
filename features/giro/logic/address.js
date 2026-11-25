// @ts-check
// Address text of the route planner: normalisation, Photon results, the match with the door points
// the courier has learned and the search of a whole list. Reading addresses out of a scanned or
// pasted text is in extract.js. Pure: no DOM, no storage, no network.
import { isLat, isLon, cleanText } from '../../../core/pure/validators.js';
import { round } from '../../../core/pure/geo-math.js';

export const PASTE_MAX_LINES = 150;
export const QUERY_MIN = 3;
export const QUERY_MAX = 120;
export const LABEL_MAX = 80;

/** @typedef {{key:string, label:string, lat:number, lon:number, n:number, updatedAt:number}} DoorPoint */
/** @typedef {{id:string, lat:number, lon:number, label:string, sub:string, town:string}} Suggestion */
/** @typedef {{kind:'coords', lat:number, lon:number, label:string} | {kind:'address', text:string}} PasteItem */

const ABBREVIATIONS = /** @type {[RegExp, string][]} */ ([
  [/\bp\.?\s?z{1,2}a\b\.?/g, 'piazza'],
  [/\bp\.?le\b\.?/g, 'piazzale'],
  [/\bc\.?so\b\.?/g, 'corso'],
  [/\bv\.?le\b\.?/g, 'viale'],
  [/\bl\.?go\b\.?/g, 'largo'],
  [/\bv\.\s*(?=[a-z])/g, 'via '],
  [/\bstr\.\s*/g, 'strada '],
  [/\bloc\.\s*/g, 'localita '],
  [/\bfraz\.\s*/g, 'frazione '],
]);
// Only as the last part after a comma: "Viale Italia" is a street.
const COUNTRY_RE = /,\s*(?:italia|italy)\s*$/;

/**
 * One spelling for one address: lower case, no accents, no punctuation, usual abbreviations written
 * out, no postal code. "V.le Italia n. 12/A, 57127 Livorno (LI)" → "viale italia 12a livorno".
 * @param {string} text @returns {string} '' when nothing is left
 */
export function normalizeAddress(text) {
  let s = String(text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[‘’'`]/g, ' ').replace(/\(\s*[a-z]{2}\s*\)/g, ' ').replace(COUNTRY_RE, ' ');
  for (const [re, word] of ABBREVIATIONS) s = s.replace(re, word);
  // "n. 12", "n°12", "civico 12" → "12"; then "12/a", "12 - a" → "12a". A letter after a plain space
  // is left alone: while typing it is the first letter of the town.
  s = s.replace(/\b(?:n|nr|num|numero|civico)\b\s*[.°º]?\s*(?=\d)/g, ' ').replace(/[°º]/g, ' ');
  s = s.replace(/\b(\d{1,4})\s*[/-]\s*([a-z])\b/g, '$1$2');
  s = s.replace(/\b\d{5}\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  return s.slice(0, QUERY_MAX).trim();
}

const words = (key) => (key ? key.split(' ') : []);
const isNumber = (w) => /^\d/.test(w);

/** Text shown for a stop: one line, no control characters, at most `max` characters. */
export function cleanLabel(text, max = LABEL_MAX) {
  const s = cleanText(String(text ?? '').replace(/\s+/g, ' '));
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/**
 * "43.5519, 10.3080" (also with ';' or a space, and an optional short label after it).
 * @param {string} line @returns {{lat:number, lon:number, label:string}|null}
 */
export function parseCoords(line) {
  const m = /^\s*(-?\d{1,2}\.\d{3,8})\s*[,; ]\s*(-?\d{1,3}\.\d{3,8})(?:[\s,;]+(.*))?$/.exec(String(line ?? ''));
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!isLat(lat) || !isLon(lon)) return null;
  return { lat: round(lat, 6), lon: round(lon, 6), label: cleanLabel(m[3] ?? '', 40) };
}

const field = (v, max = 60) => (typeof v === 'string' ? cleanText(v).slice(0, max) : '');

/**
 * Photon features (GeoJSON) → rows to choose from. Broken features are dropped. The coordinates are
 * used for the stop of today only: they are never stored as a door point.
 * @param {unknown} features @returns {Suggestion[]}
 */
export function photonSuggestions(features) {
  /** @type {Suggestion[]} */
  const out = [];
  const seen = new Set();
  for (const f of Array.isArray(features) ? features : []) {
    const c = f?.geometry?.coordinates;
    const p = f?.properties ?? {};
    if (!Array.isArray(c) || !isLat(c[1]) || !isLon(c[0])) continue;
    const street = field(p.street);
    const name = field(p.name);
    const number = field(p.housenumber, 10);
    const town = field(p.city) || field(p.town) || field(p.village) || field(p.locality) || field(p.district);
    const line = street ? [street, number].filter(Boolean).join(' ') : name;
    if (!line) continue;
    const title = name && street && !number && name !== street ? `${name}, ${line}` : line;
    const label = cleanLabel([title, town !== title ? town : ''].filter(Boolean).join(', '));
    const sub = [field(p.postcode, 10), field(p.county) !== town ? field(p.county) : '', field(p.state)]
      .filter(Boolean).join(' · ');
    const id = `${normalizeAddress(label)}@${round(c[1], 4)},${round(c[0], 4)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, lat: round(c[1], 6), lon: round(c[0], 6), label, sub, town });
  }
  return out;
}

/**
 * Search as you type among the learned door points: every word typed is in the learned address, and
 * the last word may be only its beginning. Most confirmed first.
 * @param {string} text @param {DoorPoint[]} points @param {number} [limit] @returns {DoorPoint[]}
 */
export function searchDoorPoints(text, points, limit = 3) {
  const q = words(normalizeAddress(text));
  if (q.join('').length < QUERY_MIN) return [];
  const key = q.join(' ');
  const last = q.length - 1;
  return points.filter((p) => {
    const k = words(p.key);
    return q.every((w, i) => (i === last ? k.some((x) => x.startsWith(w)) : k.includes(w)));
  }).sort((a, b) => Number(b.key === key) - Number(a.key === key) || b.n - a.n || b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

/**
 * The answer that fits a complete address best, for lines resolved without the courier choosing: the
 * service's first answer can be the same street in another town. Counts the words in common, the
 * house number and, above all, a town that the line names. Ties keep the service's order.
 * A word of the street weighs more than the house number: "Via Roma 12" must go to Via Roma without
 * a number, never to number 12 of another street.
 * @param {string} text @param {Suggestion[]} list @returns {Suggestion|null}
 */
export function pickSuggestion(text, list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const q = words(normalizeAddress(text));
  const names = new Set(q.filter((w) => !isNumber(w)));
  const numbers = q.filter(isNumber);
  let best = list[0];
  let top = -1;
  for (const s of list) {
    const k = new Set(words(normalizeAddress(s.label)));
    const town = words(normalizeAddress(s.town ?? ''));
    let score = 0;
    for (const w of k) if (names.has(w)) score += 2;
    if (numbers.length > 0 && numbers.every((n) => k.has(n))) score += 1;
    if (town.length > 0 && town.every((w) => names.has(w))) score += 3;
    if (score > top) {
      best = s;
      top = score;
    }
  }
  return best;
}

/** Pause between two online lookups of a pasted list (SPEC 11): the service only asks to be fair. */
export const PASTE_GAP_MS = 1500;

/**
 * Resolves a list (read by extract.js from a scan or a paste) one line at a time: coordinates as they
 * are, then the learned door points, then the online search (best answer), with a pause between two
 * online lookups. A line nobody knows goes to `missing`. When the service says it is off or offline,
 * no further lookup is tried.
 * @param {PasteItem[]} items
 * @param {{doorPoints:DoorPoint[], online:null|((text:string)=>Promise<Suggestion[]>),
 *   wait:(ms:number)=>Promise<void>, onProgress?:(done:number, total:number)=>void,
 *   stopped?:()=>boolean}} deps
 * @returns {Promise<{stops:{lat:number, lon:number, label:string, src:'coords'|'door'|'address',
 *   addr:string|null}[], missing:string[], missingAt:number[], left:string[], stoppedAt:number,
 *   learned:number, down:string|null}>}
 *   `missingAt`: where the missing lines are in `items`; `left`: lines not tried because the courier
 *   stopped, from index `stoppedAt` on; `down`: why the online search gave up
 */
export async function resolveItems(items, deps) {
  const stops = [];
  /** @type {string[]} */
  const missing = [];
  /** @type {number[]} */
  const missingAt = [];
  let learned = 0;
  let asked = 0;
  /** @type {string|null} */
  let down = deps.online ? null : 'service-off';
  let i = 0;
  for (; i < items.length; i++) {
    if (deps.stopped?.()) break;
    const item = items[i];
    if (item.kind === 'coords') {
      stops.push({ lat: item.lat, lon: item.lon, label: item.label, src: /** @type {const} */ ('coords'), addr: null });
    } else {
      const door = resolveDoorPoint(item.text, deps.doorPoints);
      let hit = null;
      if (door) {
        learned++;
        stops.push({ lat: door.lat, lon: door.lon, label: door.label, src: /** @type {const} */ ('door'),
          addr: door.key });
      } else if (deps.online && !down) {
        for (let attempt = 0; attempt < 2 && !hit && !down; attempt++) {
          if (asked++ > 0) await deps.wait(PASTE_GAP_MS);
          try {
            hit = pickSuggestion(item.text, await deps.online(item.text));
            break;
          } catch (err) {
            const code = String(/** @type {any} */ (err)?.code ?? '');
            if (code === 'offline' || code === 'service-off') down = code;
            // Too close to the previous request: wait once more and ask again. Anything else: next line.
            else if (code !== 'rate-limited') break;
          }
        }
        if (hit) {
          stops.push({ lat: hit.lat, lon: hit.lon, label: hit.label, src: /** @type {const} */ ('address'),
            addr: normalizeAddress(item.text) || null });
        }
      }
      if (!door && !hit) {
        missing.push(item.text);
        missingAt.push(i);
      }
    }
    deps.onProgress?.(i + 1, items.length);
  }
  const left = items.slice(i).map((it) => (it.kind === 'coords' ? `${it.lat}, ${it.lon} ${it.label}`.trim() : it.text));
  return { stops, missing, missingAt, left, stoppedAt: i, learned, down };
}

/**
 * A complete address (a pasted line) resolved on the device: the same normalised text, or the same
 * street words and house number when one of the two also carries the town or the province. Without a
 * house number, or with two candidates, the answer is null and the online search decides.
 * @param {string} text @param {DoorPoint[]} points @returns {DoorPoint|null}
 */
export function resolveDoorPoint(text, points) {
  const key = normalizeAddress(text);
  if (!key) return null;
  const exact = points.find((p) => p.key === key);
  if (exact) return exact;
  const q = words(key);
  const numbers = q.filter(isNumber).join(' ');
  const names = q.filter((w) => !isNumber(w));
  if (!numbers || names.length < 2) return null;
  const hits = points.filter((p) => {
    const k = words(p.key);
    if (k.filter(isNumber).join(' ') !== numbers) return false;
    const other = k.filter((w) => !isNumber(w));
    const [few, many] = names.length <= other.length ? [names, other] : [other, names];
    return few.length >= 2 && few.every((w) => many.includes(w));
  });
  return hits.length === 1 ? hits[0] : null;
}
