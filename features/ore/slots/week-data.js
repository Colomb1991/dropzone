// @ts-check
import { t, tn, shifts, settings, format, clock } from '../../../core/api.js';
import { weekSummary, weekStart, addDays } from '../logic/hours.js';

/** Summary of the week of `at` (default: now), from the stored shifts. */
export async function loadWeek(at = clock.now()) {
  const from = weekStart(at);
  const list = await shifts.listShifts({ from, to: addDays(from, 7) - 1 });
  return weekSummary(list, { weekStartAt: from, weeklyHours: settings.get('contract.weeklyHours'),
    breakPaid: settings.get('contract.breakPaid') === true, now: clock.now() });
}

/** "32 h 10 · 4 giorni" */
export function weekLine(w) {
  return t('ore.week.line', { d: format.duration(w.workedMs), days: tn('ore.days', w.days, { n: w.days }) });
}

/** `shift.end` slot: one line; the hours over contract only when a contract is set and there are any. */
export async function endLines(ctx) {
  const w = await loadWeek(ctx?.shift?.startAt ?? clock.now());
  if (w.count === 0) return [];
  const d = format.duration(w.workedMs);
  const text = w.overMs
    ? t('ore.week.endLineOver', { d, over: format.duration(w.overMs) })
    : t('ore.week.endLine', { d });
  return [{ kind: 'line', icon: 'clock', text }];
}
