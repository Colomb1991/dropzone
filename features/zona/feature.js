// @ts-check
import { validateImport } from './logic/zone-file.js';

export default {
  id: 'zona',
  routes: [
    { path: '/zona', load: () => import('./screens/zona.js'), titleKey: 'zona.title', chrome: 'back' },
  ],
  nav: [{ place: 'more', order: 20, labelKey: 'zona.nav', icon: 'upload', to: '/zona' }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  stores: [{ name: 'imports', keyPath: 'id', since: 1, backup: 'never', validate: validateImport }],
};
