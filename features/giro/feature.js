// @ts-check
// Giro (Beta): the route planner, first item of Release 2 (DECISIONS 11). Stops are addresses or
// points only. What it learns (door points, leg times) stays on the phone.
import { validateRoute } from './logic/route.js';
import { validateDoorPoint, validateLegTime } from './logic/learn.js';

const isBool = (v) => typeof v === 'boolean';

export default {
  id: 'giro',
  routes: [
    { path: '/giro', load: () => import('./screens/giro.js'), titleKey: 'giro.title', chrome: 'back' },
    { path: '/giro/aggiungi', load: () => import('./screens/add.js'), titleKey: 'giro.add.title', chrome: 'back' },
  ],
  nav: [{ place: 'more', order: 5, labelKey: 'giro.nav', icon: 'route', to: '/giro', beta: true }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  css: new URL('./giro.css', import.meta.url).href,
  stores: [
    // The route of today deletes itself after 24 hours and never enters a backup (SPEC 11).
    { name: 'route', keyPath: 'id', since: 1, backup: 'never', validate: validateRoute },
    // Learned by the courier's own phone: kept, and part of the backup.
    { name: 'doorPoints', keyPath: 'key', since: 1, backup: 'always', validate: validateDoorPoint },
    { name: 'legTimes', keyPath: 'id', since: 1, backup: 'always', validate: validateLegTime },
  ],
  settingKeys: {
    // The one-time explanation of the online address search has been answered (yes or not now).
    'giro.photonAsked': { default: false, validate: isBool },
  },
  slots: [
    { slot: 'home.tiles', order: 5, provide: () => import('./slots/tiles.js').then((m) => m.homeTile()) },
    { slot: 'shift.context', order: 10, watch: ['route'],
      provide: () => import('./slots/shift-row.js').then((m) => m.contextRows()) },
  ],
  start: () => {
    import('./logic/data.js').then((m) => m.purgeExpired());
  },
};
