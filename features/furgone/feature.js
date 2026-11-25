// @ts-check
// Diario furgone: guided van photos with a burnt-in stamp. Declares the `van` store.
import { t } from '../../core/api.js';
import { validateVan, mediaRefs } from './logic/van.js';
import { validChecklist } from './logic/checklist.js';

export default {
  id: 'furgone',
  routes: [
    { path: '/furgone', load: () => import('./screens/diary.js'), titleKey: 'furgone.title', chrome: 'back' },
  ],
  nav: [{ place: 'more', order: 40, labelKey: 'furgone.nav', icon: 'truck', to: '/furgone' }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  css: new URL('./furgone.css', import.meta.url).href,
  stores: [
    // mediaRefs: a backup made without van photos leaves out the sessions that need them (whole or
    // not at all). The checklist ticked in a session is a field of its record: no new store, and
    // records saved before it existed stay valid as they are.
    { name: 'van', keyPath: 'id', since: 1, backup: 'always', validate: validateVan, mediaRefs,
      indexes: [{ name: 'at', keyPath: 'at' }, { name: 'shiftId', keyPath: 'shiftId' }] },
  ],
  settingKeys: {
    // The courier's own checklist (at most 10 lines); null = the default list in the app language.
    'furgone.checklist': { default: null, validate: validChecklist },
  },
  slots: [
    { slot: 'home.tiles', order: 10, provide: async () => [{ icon: 'truck', labelKey: 'furgone.nav', to: '/furgone' }] },
    { slot: 'shift.end', order: 50,
      provide: async () => [{ kind: 'row', icon: 'camera', text: t('furgone.endRow'), to: '/furgone' }] },
  ],
};
