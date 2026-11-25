// @ts-check
// Onboarding: install gate (iOS in a browser tab) and the five first-run screens.
export default {
  id: 'benvenuto',
  routes: [
    { path: '/benvenuto', load: () => import('./screens/welcome.js'), titleKey: 'benvenuto.title', chrome: 'none',
      open: true },
  ],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  css: new URL('./benvenuto.css', import.meta.url).href,
};
