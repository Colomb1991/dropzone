// @ts-check
// Frasi pronte (SPEC 11): twelve doorstep and intercom phrases the phone says in Italian.
// Nothing is stored and nothing leaves the phone: the voice is the one installed on it.
export default {
  id: 'frasi',
  routes: [
    { path: '/frasi', load: () => import('./screens/frasi.js'), titleKey: 'frasi.title', chrome: 'back' },
  ],
  nav: [{ place: 'more', order: 45, labelKey: 'frasi.nav', icon: 'message-circle', to: '/frasi' }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  css: new URL('./frasi.css', import.meta.url).href,
};
