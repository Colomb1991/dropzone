// @ts-check
// Furgone qui (SPEC 11): one tap saves where the van is parked, the screen brings the courier back.
// The point lives in its own store, never enters a backup and deletes itself after 24 hours.
import { validateSpot } from './logic/spot.js';

export default {
  id: 'furgone-qui',
  routes: [
    { path: '/furgone-qui', load: () => import('./screens/spot.js'), titleKey: 'furgone-qui.title', chrome: 'back' },
  ],
  nav: [{ place: 'more', order: 42, labelKey: 'furgone-qui.nav', icon: 'circle-parking', to: '/furgone-qui' }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  css: new URL('./furgone-qui.css', import.meta.url).href,
  stores: [{ name: 'vanSpot', keyPath: 'id', since: 1, backup: 'never', validate: validateSpot }],
  slots: [{ slot: 'shift.tools', order: 10, load: () => import('./slots/shift-tile.js') }],
  start: () => {
    import('./logic/data.js').then((m) => m.purgeExpired());
  },
};
