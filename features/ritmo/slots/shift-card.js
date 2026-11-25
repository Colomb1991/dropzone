// @ts-check
// Slot shift.context: one row. Before the first count it says what to do (rank 40: anything with
// news goes first); afterwards the margin and the time back (rank 20). Same neutral row whatever
// the numbers say.
import { t, format, clock, session, store } from '../../../core/api.js';
import { paceProject } from '../logic/pace.js';
import { loadPace, projectionInput } from '../logic/data.js';

/** @returns {Promise<{rank:number, icon:string, title:string, sub:string, to:string}[]>} */
export async function contextRows() {
  const shift = session.active();
  // The 45-second demo shows the shift home as Release 1 wrote it: no pace row there.
  if (!shift || store.getState().sandbox) return [];
  const pr = paceProject(projectionInput(shift, await loadPace(), clock.now()));
  let title = t('ritmo.nav');
  // One line on the shift home: the short form of "Alla prima consegna dimmi quante ne hai."
  let sub = t('ritmo.card.first');
  if (pr.state === 'collecting') {
    sub = t('ritmo.card.collecting', { n: pr.left ?? 0 });
  } else if (pr.state === 'ready' && pr.finishAt !== null) {
    const d = format.duration(Math.abs(pr.marginMin ?? 0) * 60000);
    if (pr.marginMin !== null && pr.marginMin > 0) title = t('ritmo.card.margin', { d });
    else if (pr.marginMin !== null && pr.marginMin < 0) title = t('ritmo.card.over', { d });
    sub = t('ritmo.line.plain', { time: format.time(pr.finishAt) });
  }
  if (pr.askAgain) sub = t('ritmo.card.askAgain');
  return [{ rank: pr.state === 'empty' ? 40 : 20, icon: 'gauge', title, sub, to: '/ritmo' }];
}
