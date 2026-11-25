// @ts-check
// Turno (SPEC 2.4, 2.5, 4.2): home outside and during a shift, briefing, break, end card, recovery.
export default {
  id: 'turno',
  routes: [
    { path: '/', load: () => import('./screens/home.js'), titleKey: 'turno.title', chrome: 'tabs' },
  ],
  nav: [{ place: 'tab', order: 1, labelKey: 'turno.nav', icon: 'house', to: '/' }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  css: new URL('./turno.css', import.meta.url).href,
  slots: [
    // Forgotten stop: the dialog must appear on whatever screen the app opens.
    { slot: 'overlay', order: 10, load: () => import('./screens/recovery.js') },
  ],
  start() {
    let off = null;
    let stopped = false;
    import('./state.js').then((m) => {
      if (!stopped) off = m.start();
    });
    return () => {
      stopped = true;
      if (off) off();
    };
  },
};
