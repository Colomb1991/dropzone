// @ts-check
// SPEC 6.10 "Trovato chiuso / Trovato aperto".
import { isoDay } from './schedule.js';

export const MAX_VISITS = 60;

/** @typedef {{day:number, min:number, open:boolean, ym:string, mine:boolean}} Visit */
/** @typedef {{kind:'A'|'B'|'C'|'D', day?:number, hour?:number, block?:number,
 *   closed:number, open:number, total:number}} VisitLine */

/** @param {Date} date @param {boolean} open @param {boolean} [mine] @returns {Visit} */
export function visitStamp(date, open, mine = true) {
  const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return { day: isoDay(date), min: date.getHours() * 60 + date.getMinutes(), open, ym, mine };
}

/** Appends a stamp; at 60 the oldest goes. */
export function addStamp(visits, stamp) {
  const list = [...(visits ?? []), stamp];
  return list.length > MAX_VISITS ? list.slice(list.length - MAX_VISITS) : list;
}

/** Removes the newest own stamp (undo of the last tap). */
export function removeLastOwn(visits) {
  const list = [...(visits ?? [])];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].mine) {
      list.splice(i, 1);
      break;
    }
  }
  return list;
}

/** Zone import: received stamps get `mine: false`; exact duplicates are skipped; own stamps stay. */
export function mergeStamps(local, incoming) {
  const key = (v) => `${v.day}|${v.min}|${v.open}|${v.ym}`;
  const seen = new Set((local ?? []).map(key));
  const list = [...(local ?? [])];
  for (const v of incoming ?? []) {
    if (seen.has(key(v))) continue;
    seen.add(key(v));
    list.push({ day: v.day, min: v.min, open: v.open, ym: v.ym, mine: false });
  }
  while (list.length > MAX_VISITS) {
    const i = list.findIndex((v) => !v.mine);
    list.splice(i < 0 ? 0 : i, 1);
  }
  return list;
}

function monthIndex(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : -1;
}

function summarize(list) {
  const closed = list.filter((v) => !v.open).length;
  const mins = list.map((v) => v.min).sort((a, b) => a - b);
  const mid = mins.length >> 1;
  const median = mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2;
  return { closed, open: list.length - closed, total: list.length, hour: Math.round(median / 60) % 24 };
}

/**
 * @param {Visit[]} visits
 * @param {number} now epoch ms
 * @returns {{lines: VisitLine[], closedNow: boolean}}
 */
export function visitPattern(visits, now) {
  const date = new Date(now);
  const nowIdx = date.getFullYear() * 12 + date.getMonth();
  const recent = (visits ?? []).filter((v) => {
    const idx = monthIndex(v.ym);
    return idx >= nowIdx - 12 && idx <= nowIdx;
  });
  /** @type {Map<number, Visit[]>} */
  const byBlock = new Map();
  /** @type {Map<string, Visit[]>} */
  const byDayBlock = new Map();
  /** @type {Map<number, Visit[]>} */
  const byDay = new Map();
  const push = (map, k, v) => map.set(k, [...(map.get(k) ?? []), v]);
  for (const v of recent) {
    const block = Math.floor(v.min / 120);
    push(byBlock, block, v);
    push(byDayBlock, `${v.day}:${block}`, v);
    push(byDay, v.day, v);
  }
  /** @type {VisitLine[]} */
  const a = [];
  for (const [block, list] of byBlock) {
    const s = summarize(list);
    if (s.total >= 3 && new Set(list.map((v) => v.day)).size >= 2 && s.closed / s.total >= 0.6) {
      a.push({ kind: 'A', block, ...s });
    }
  }
  /** @type {VisitLine[]} */
  const b = [];
  for (const [key, list] of byDayBlock) {
    const [day, block] = key.split(':').map(Number);
    const s = summarize(list);
    if (s.total >= 2 && s.closed / s.total >= 0.6 && !a.some((l) => l.block === block)) {
      b.push({ kind: 'B', day, block, ...s });
    }
  }
  /** @type {VisitLine[]} */
  const c = [];
  for (const [day, list] of byDay) {
    const s = summarize(list);
    const blocks = new Set(list.filter((v) => !v.open).map((v) => Math.floor(v.min / 120)));
    if (s.open === 0 && s.closed >= 2 && blocks.size >= 2 && !b.some((l) => l.day === day)) {
      c.push({ kind: 'C', day, closed: s.closed, open: 0, total: s.total });
    }
  }
  const bySize = (x, y) => y.total - x.total;
  let lines = [...a.sort(bySize), ...b.sort(bySize), ...c.sort(bySize)].slice(0, 2);
  if (lines.length === 0 && recent.length >= 3) {
    const s = summarize(recent);
    if (s.open / s.total >= 0.8) lines = [{ kind: 'D', closed: s.closed, open: s.open, total: s.total }];
  }
  const today = isoDay(date);
  const blockNow = Math.floor((date.getHours() * 60 + date.getMinutes()) / 120);
  const closedNow = lines.some((l) => (l.kind === 'A' && l.block === blockNow)
    || (l.kind === 'B' && l.block === blockNow && l.day === today));
  return { lines, closedNow };
}
