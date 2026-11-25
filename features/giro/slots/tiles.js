// @ts-check
// Tile on the home outside a shift: "Giro", with the progress of the route when there is one.
import { t, log } from '../../../core/api.js';
import { loadRoute } from '../logic/data.js';
import { progress } from '../logic/route.js';

/** @returns {Promise<{icon:string, labelKey:string, to:string, value:string}[]>} */
export async function homeTile() {
  const p = await loadRoute().then(progress, (err) => {
    log.warn('giro', 'tile-failed', { code: String(err?.code ?? '') });
    return { done: 0, total: 0 };
  });
  return [{ icon: 'route', labelKey: 'giro.nav', to: '/giro',
    value: p.total ? t('giro.tile.progress', p) : t('giro.beta') }];
}
