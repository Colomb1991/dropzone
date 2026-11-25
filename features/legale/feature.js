// @ts-check
// Legal pages (privacy, terms, disclaimers, services and licences) and the "terms updated" dialog.
import { config, settings } from '../../core/api.js';
import { termsOutdated } from './logic/docs.js';

/** The dialog module is fetched only when the accepted terms are not the ones of this build. */
const outdated = () => termsOutdated(settings.get('onboardedAt'), settings.get('termsVersion'),
  config.TERMS_VERSION);

export default {
  id: 'legale',
  routes: [
    { path: '/legale/:doc', load: () => import('./screens/doc.js'), titleKey: 'legale.title', chrome: 'back',
      open: true },
  ],
  nav: [{ place: 'more', order: 100, labelKey: 'legale.nav', icon: 'shield-check', to: '/legale/privacy' }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  css: new URL('./legale.css', import.meta.url).href,
  slots: [{ slot: 'overlay', order: 90, visible: outdated, load: () => import('./screens/terms-update.js') }],
};
