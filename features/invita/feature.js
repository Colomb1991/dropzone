// @ts-check
// Fai provare a un collega (SPEC 11): the app's own address as a QR code drawn on the phone, plus
// the plain link share. The row in "Altro" belongs to the shell; this is the screen it opens.
export default {
  id: 'invita',
  routes: [
    { path: '/invita', load: () => import('./screens/invita.js'), titleKey: 'invita.title', chrome: 'back' },
  ],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  css: new URL('./invita.css', import.meta.url).href,
};
