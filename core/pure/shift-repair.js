// @ts-check
// A shift left open without being the running one (a "phantom": the app died between two writes of
// an older version, or a file brought it in). Pure rules for boot and for restore.
import { validateShift } from './validators.js';

/** @typedef {import('../types.js').Shift} Shift */

/** A phantom shorter than this never really ran: it is removed instead of closed. */
export const PHANTOM_MIN_MS = 60000;

/**
 * Closes a shift where the app last saw it. A break still open ends at its planned end, at most there.
 * @param {Shift} s @returns {Shift}
 */
export function closeAtLastSeen(s) {
  const endAt = Math.max(s.startAt, s.lastSeenAt);
  return { ...s, endAt, edited: true, breaks: s.breaks.map((b) => (b.endAt === null
    ? { ...b, endAt: Math.max(b.startAt, Math.min(b.startAt + b.plannedMin * 60000, endAt)), auto: true } : b)) };
}

/**
 * What boot must do with the stored shifts. Only the shift the pointer names may stay open; every
 * other open shift is closed where it was last seen (flagged "Modificato"), or removed when it
 * never ran. A pointer to a missing or closed shift is dropped.
 * @param {unknown[]} records every record of the `shifts` store @param {string|null} activeId
 * @returns {{active:Shift|null, activeId:string|null, close:Shift[], remove:string[]}}
 */
export function repairPlan(records, activeId) {
  /** @type {Shift|null} */
  let active = null;
  /** @type {Shift[]} */
  const close = [];
  /** @type {string[]} */
  const remove = [];
  for (const raw of Array.isArray(records) ? records : []) {
    const s = validateShift(raw);
    if (!s || s.endAt !== null) continue;
    if (activeId !== null && s.id === activeId && !active) {
      active = s;
      continue;
    }
    const closed = closeAtLastSeen(s);
    if (closed.breaks.length === 0 && /** @type {number} */ (closed.endAt) - closed.startAt < PHANTOM_MIN_MS) {
      remove.push(s.id);
    } else {
      close.push(closed);
    }
  }
  return { active, activeId: active ? active.id : null, close, remove };
}
