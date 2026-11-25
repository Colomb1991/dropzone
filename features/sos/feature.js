// @ts-check
// SOS (SPEC 4.10): two real links, never locked by movement, open in a second window too.
// Also the quick numbers and the accident card (SPEC 11).
import { validateQuick } from './logic/quick.js';

export default {
  id: 'sos',
  routes: [
    { path: '/sos', load: () => import('./screens/sos.js'), titleKey: 'sos.title', chrome: 'tabs', open: true,
      whileMoving: true },
  ],
  nav: [{ place: 'tab', order: 4, labelKey: 'sos.nav', icon: 'phone', to: '/sos', tone: 'danger' }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  css: new URL('./sos.css', import.meta.url).href,
  settingKeys: {
    // Up to five {name, number} the courier types: stored with the settings, so part of the backup.
    'sos.quick': { default: [], validate: validateQuick },
  },
};
