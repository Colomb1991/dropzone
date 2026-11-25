// @ts-check
// Diario furgone: guided van photos with a burnt-in stamp. Declares the `van` store.
import { t } from '../../core/api.js';
import { validateVan } from './logic/van.js';

export default {
  id: 'furgone',
  routes: [
    { path: '/furgone', load: () => import('./screens/diary.js'), titleKey: 'furgone.title', chrome: 'back' },
  ],
  nav: [{ place: 'more', order: 40, labelKey: 'furgone.nav', icon: 'truck', to: '/furgone' }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  css: new URL('./furgone.css', import.meta.url).href,
  stores: [
    { name: 'van', keyPath: 'id', since: 1, backup: 'always', validate: validateVan,
      indexes: [{ name: 'at', keyPath: 'at' }, { name: 'shiftId', keyPath: 'shiftId' }] },
  ],
  slots: [
    { slot: 'home.tiles', order: 10, provide: async () => [{ icon: 'truck', labelKey: 'furgone.nav', to: '/furgone' }] },
    { slot: 'shift.end', order: 50,
      provide: async () => [{ kind: 'row', icon: 'camera', text: t('furgone.endRow'), to: '/furgone' }] },
  ],
};
