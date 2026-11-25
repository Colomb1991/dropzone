// @ts-check
// Pure helpers of the shift screens (SPEC 2.4, 3.2, 4.2, 6.4).

const HOUR_MS = 3600000;

/**
 * In turno, Pausa, Ore lavorate of one shift. A running shift counts up to `now`.
 * @param {{startAt:number, endAt:number|null, breaks:{startAt:number, endAt:number|null, plannedMin:number}[]}} shift
 * @param {boolean} breakPaid @param {number} now
 */
export function shiftStats(shift, breakPaid, now) {
  const end = shift.endAt ?? Math.max(now, shift.startAt);
  const inShiftMs = Math.max(0, end - shift.startAt);
  let breakMs = 0;
  for (const b of shift.breaks ?? []) {
    const bEnd = b.endAt ?? Math.min(end, b.startAt + b.plannedMin * 60000);
    breakMs += Math.max(0, bEnd - b.startAt);
  }
  breakMs = Math.min(breakMs, inShiftMs);
  return { inShiftMs, breakMs, workedMs: breakPaid ? inShiftMs : inShiftMs - breakMs };
}

/** 05–12 morning, 12–18 afternoon, 18–05 evening. @returns {'morning'|'afternoon'|'evening'} */
export function greeting(ts) {
  const h = new Date(ts).getHours();
  if (h >= 5 && h < 12) return 'morning';
  return h >= 12 && h < 18 ? 'afternoon' : 'evening';
}

/** Under 8 h, 8–10 h, over 10 h. @returns {'short'|'full'|'long'} */
export function closing(inShiftMs) {
  if (inShiftMs < 8 * HOUR_MS) return 'short';
  return inShiftMs <= 10 * HOUR_MS ? 'full' : 'long';
}

function atTime(dayTs, hhmm, addDays = 0) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(dayTs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + addDays, h, m, 0, 0).getTime();
}

/** "Cambia" in the briefing: `hhmm` today, not after now. Null when it is in the future. */
export function startFromTime(hhmm, now) {
  const ts = atTime(now, hhmm);
  return ts <= now ? ts : null;
}

/**
 * Forgotten stop: `hhmm` on the day the app was last seen, moved by one day when the shift crossed
 * midnight. Null unless start ≤ result ≤ now.
 * @param {string} hhmm @param {{startAt:number, lastSeenAt:number}} shift @param {number} now
 */
export function endFromTime(hhmm, shift, now) {
  for (const shiftDays of [0, 1, -1]) {
    const ts = atTime(shift.lastSeenAt, hhmm, shiftDays);
    if (ts >= shift.startAt && ts <= now) return ts;
  }
  return null;
}

/** "0742" for the keypad. */
export function timeDigits(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
}

/** "29:05" (minutes may exceed 59), never negative. */
export function countdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Break tile and sheet state. @returns {{running:boolean, endsAt:number|null, leftMs:number}} */
export function breakState(shift, now) {
  const b = shift ? (shift.breaks ?? []).find((x) => x.endAt === null) : null;
  if (!b) return { running: false, endsAt: null, leftMs: 0 };
  const endsAt = b.startAt + b.plannedMin * 60000;
  return { running: true, endsAt, leftMs: Math.max(0, endsAt - now) };
}

/** Weekly hours typed as "Altro": 20–48 in steps of 0,5. */
export function validWeeklyHours(v) {
  return typeof v === 'number' && v >= 20 && v <= 48 && (v * 2) % 1 === 0;
}
