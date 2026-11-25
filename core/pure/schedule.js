// @ts-check
// SPEC 6.2. schedule = null | {days: number[] (1 = Monday … 7 = Sunday), windows: {from, to}[] (0–2)}.
export const LEAD_MIN = 15;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** @param {string} hhmm @returns {number} minutes of the day, or -1 */
export function parseHHMM(hhmm) {
  const m = typeof hhmm === 'string' ? HHMM.exec(hhmm) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
}

/** ISO weekday of a local date: 1 = Monday … 7 = Sunday. */
export function isoDay(date) {
  return date.getDay() === 0 ? 7 : date.getDay();
}

/** @returns {import('../types.js').Schedule|undefined} undefined = invalid; null is a valid schedule */
export function validateSchedule(s) {
  if (s === null || s === undefined) return null;
  if (typeof s !== 'object' || !Array.isArray(s.days) || s.days.length < 1) return undefined;
  const days = [...new Set(s.days)].sort((a, b) => a - b);
  if (!days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) return undefined;
  const wins = s.windows === undefined ? [] : s.windows;
  if (!Array.isArray(wins) || wins.length > 2) return undefined;
  const windows = [];
  for (const w of wins) {
    if (!w || parseHHMM(w.from) < 0 || parseHHMM(w.to) < 0) return undefined;
    windows.push({ from: w.from, to: w.to });
  }
  return { days, windows };
}

function at(date, dayOffset, minutes) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset, 0, minutes).getTime();
}

/**
 * @param {import('../types.js').Schedule} schedule
 * @param {Date} date
 * @returns {{active:boolean, leadMin:number|null, until:string|null}}
 */
export function scheduleStatus(schedule, date) {
  if (!schedule) return { active: true, leadMin: null, until: null };
  const now = date.getTime();
  const today = isoDay(date);
  if (!schedule.windows || schedule.windows.length === 0) {
    return { active: schedule.days.includes(today), leadMin: null, until: null };
  }
  let lead = null;
  // A window belongs to its start day: check yesterday (overnight), today, tomorrow (lead over midnight).
  for (const off of [-1, 0, 1]) {
    const day = ((today - 1 + off + 7) % 7) + 1;
    if (!schedule.days.includes(day)) continue;
    for (const w of schedule.windows) {
      const from = parseHHMM(w.from);
      const to = parseHHMM(w.to);
      const start = at(date, off, from);
      const end = at(date, to <= from ? off + 1 : off, to);
      if (now >= start && now <= end) return { active: true, leadMin: null, until: w.to };
      if (now < start && now >= start - LEAD_MIN * 60000 && lead === null) {
        lead = { active: true, leadMin: Math.max(1, Math.ceil((start - now) / 60000)), until: w.to };
      }
    }
  }
  return lead ?? { active: false, leadMin: null, until: null };
}

/** @param {import('../types.js').Schedule} schedule @param {Date} date */
export function isScheduleActive(schedule, date) {
  return schedule ? scheduleStatus(schedule, date).active : true;
}

/**
 * For the briefing: the window of a timed note that starts today. Null when the note has no
 * schedule or today is not one of its days.
 * @returns {{from:string|null, to:string|null}|null}
 */
export function activeToday(schedule, date) {
  if (!schedule || !schedule.days.includes(isoDay(date))) return null;
  if (!schedule.windows || schedule.windows.length === 0) return { from: null, to: null };
  const nowMin = date.getHours() * 60 + date.getMinutes();
  const sorted = [...schedule.windows].sort((a, b) => parseHHMM(a.from) - parseHHMM(b.from));
  const next = sorted.find((w) => parseHHMM(w.to) <= parseHHMM(w.from) || parseHHMM(w.to) >= nowMin);
  const w = next ?? sorted[0];
  return { from: w.from, to: w.to };
}
