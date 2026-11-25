// @ts-check
// What the three Ritmo views share: the counts of the running shift with their projection, and the
// sentence that says it. The wording is the same everywhere and never changes tone.
import { useStore, useTick, useSetting, useLive } from '../../../ui/hooks.js';
import { t, format, clock } from '../../../core/api.js';
import { paceProject } from '../logic/pace.js';
import { loadPace, projectionInput } from '../logic/data.js';

/**
 * @returns {{shift:import('../../../core/types.js').Shift|null, pace:import('../logic/pace.js').Pace|null,
 *   projection:import('../logic/pace.js').Projection|null, now:number, loading:boolean}}
 */
export function usePace() {
  const shift = useStore((s) => s.shift);
  // The projection is anchored to the last count; a look every minute is enough (break, "ask again").
  useTick(60000);
  // Read by projectionInput: subscribing redraws the view when one of them changes.
  useSetting('ritmo.returnMin');
  useSetting('shift.breakMin');
  useSetting('contract.weeklyHours');
  useSetting('contract.daysPerWeek');
  useSetting('contract.breakPaid');
  const live = useLive(['kv'], loadPace, [shift?.id]);
  const now = clock.now();
  const pace = shift && live.data && live.data.shiftId === shift.id ? live.data : null;
  const projection = shift ? paceProject(projectionInput(shift, pace, now)) : null;
  return { shift, pace, projection, now, loading: live.loading && !live.data };
}

/** "Rientri verso le 17:40. Hai 25 min di margine, pausa compresa." @param {import('../logic/pace.js').Projection} pr */
export function projectionLine(pr) {
  if (pr.state !== 'ready' || pr.finishAt === null) return t('ritmo.collecting');
  const time = format.time(pr.finishAt);
  if (pr.marginMin === null) return t('ritmo.line.plain', { time });
  const d = format.duration(Math.abs(pr.marginMin) * 60000);
  if (pr.marginMin > 0) return t('ritmo.line.margin', { time, d });
  if (pr.marginMin < 0) return t('ritmo.line.over', { time, d });
  return t('ritmo.line.even', { time });
}
