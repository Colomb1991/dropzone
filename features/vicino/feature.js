// @ts-check
import { validateCell } from './logic/poi.js';

export default {
  id: 'vicino',
  routes: [
    { path: '/vicino', load: () => import('./screens/vicino.js'), titleKey: 'vicino.title', chrome: 'tabs' },
  ],
  nav: [{ place: 'tab', order: 3, labelKey: 'vicino.nav', icon: 'locate-fixed', to: '/vicino' }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  // Never exported: it is public map data and can be loaded again.
  stores: [{ name: 'poiCells', keyPath: 'cellId', since: 1, backup: 'never', validate: validateCell }],
};
