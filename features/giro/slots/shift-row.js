// @ts-check
// Slot shift.context (rank 10): the next stop, only while a route has stops to do. A courier who
// is working a route wants this row before the pace or the weather.
import { t } from '../../../core/api.js';
import { loadRoute } from '../logic/data.js';
import { nextStop, progress } from '../logic/route.js';
import { stopLabel } from '../parts/common.js';

/** @returns {Promise<{rank:number, icon:string, tone:string, title:string, sub:string, to:string}[]>} */
export async function contextRows() {
  const route = await loadRoute();
  const next = route ? nextStop(route) : null;
  if (!route || !next) return [];
  return [{ rank: 10, icon: 'route', tone: 'success', title: stopLabel(next),
    sub: t('giro.shift.sub', progress(route)), to: '/giro' }];
}
