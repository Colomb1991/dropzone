// @ts-check
import { validateAlert } from './logic/message.js';

export default {
  id: 'segnala',
  routes: [
    { path: '/segnala', load: () => import('./screens/segnala.js'), titleKey: 'segnala.title', chrome: 'back' },
    { path: '@viewer', load: () => import('./screens/viewer.js'), titleKey: 'segnala.viewer', chrome: 'none',
      open: true },
  ],
  nav: [{ place: 'more', order: 10, labelKey: 'segnala.nav', icon: 'megaphone', to: '/segnala' }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  stores: [{ name: 'alerts', keyPath: 'id', since: 1, backup: 'never', validate: validateAlert }],
  slots: [
    { slot: 'home.sticky', order: 20, load: () => import('./screens/sticky-button.js') },
    { slot: 'map.pins', order: 20, provide: async (ctx) => (await import('./alerts.js')).pins(/** @type {any} */ (ctx)) },
  ],
  // The manifest stays light: the repository and the proximity source load after boot.
  start: () => {
    let off = () => {};
    let dead = false;
    import('./alerts.js').then((m) => {
      if (!dead) off = m.startAlerts();
    });
    return () => {
      dead = true;
      off();
    };
  },
};
