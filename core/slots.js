// @ts-check
// Slots: home.idle, home.tiles, home.shift, home.sticky, shift.context, shift.tools, briefing,
// shift.end, map.pins, diagnostics, data.counts, overlay.
// `shift.context` is a data slot: rows {rank, icon, tone?, title, sub?, to?}. The shift home shows
// only the row with the lowest rank; all of them, and the `shift.tools` components, are one tap
// away in "Strumenti".
import * as log from './log.js';

/** @type {import('./types.js').SlotItem[]} */
let all = [];

/** Boot: registers the `slots` of one feature manifest. */
export function register(featureId, defs) {
  for (const d of defs ?? []) all.push({ ...d, featureId });
  all.sort((a, b) => a.order - b.order);
}

/** Sorted by order, filtered by visible(). @param {string} slot */
export function items(slot) {
  return all.filter((s) => {
    if (s.slot !== slot) return false;
    try {
      return s.visible ? s.visible() !== false : true;
    } catch (err) {
      log.error('slots', err, { slot });
      return false;
    }
  });
}

/** Data slots: a failing provider is logged and skipped. */
export async function collect(slot, ctx = {}) {
  const out = [];
  for (const s of items(slot)) {
    if (!s.provide) continue;
    try {
      const rows = await s.provide(ctx);
      for (const row of rows ?? []) out.push({ featureId: s.featureId, ...row });
    } catch (err) {
      log.error('slots', err, { slot, feature: s.featureId ?? '' });
    }
  }
  return out;
}

/** Tests only. */
export function clear() {
  all = [];
}
