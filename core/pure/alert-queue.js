// @ts-check
/** @typedef {{model:{id:string, tone:string, distM:number}, ctx?:object}} QItem */

/**
 * Danger first, then nearest; max 3; the rest is dropped. An id already queued is not added twice.
 * @param {QItem[]} queue @param {QItem[]} items @returns {QItem[]}
 */
export function enqueue(queue, items) {
  const all = [...queue];
  for (const it of items) {
    if (!all.some((q) => q.model.id === it.model.id)) all.push(it);
  }
  const rank = (q) => (q.model.tone === 'danger' ? 0 : 1);
  return all.sort((a, b) => rank(a) - rank(b) || a.model.distM - b.model.distM).slice(0, 3);
}
