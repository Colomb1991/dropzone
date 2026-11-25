// @ts-check
// Note e avvisi (F2): zone notes, their alerts, "Cosa so di qui", stamps.
// The manifest stays light: screens, slots, providers and the proximity source load on demand.
const providers = () => import('./logic/providers.js');

export default {
  id: 'note',
  routes: [
    { path: '/note', load: () => import('./screens/list.js'), titleKey: 'note.title', chrome: 'tabs' },
    { path: '/note/:id', load: () => import('./screens/detail.js'), titleKey: 'note.title', chrome: 'back' },
    { path: '/note/:id/modifica', load: () => import('./screens/edit.js'), titleKey: 'note.edit.title',
      chrome: 'back' },
  ],
  nav: [{ place: 'tab', order: 2, labelKey: 'note.nav', icon: 'map-pin', to: '/note' }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  css: new URL('./note.css', import.meta.url).href,
  slots: [
    { slot: 'home.idle', order: 40, load: () => import('./slots/incomplete.js') },
    { slot: 'home.idle', order: 50, load: () => import('./slots/nearby-idle.js') },
    { slot: 'home.shift', order: 50, load: () => import('./slots/nearby-shift.js') },
    { slot: 'home.sticky', order: 10, load: () => import('./slots/note-here.js') },
    { slot: 'briefing', order: 20, provide: async (ctx) => (await providers()).briefing(ctx) },
    { slot: 'shift.end', order: 20, provide: async (ctx) => (await providers()).shiftEnd(ctx) },
    { slot: 'data.counts', order: 10, provide: async () => (await providers()).counts() },
  ],
  start: () => {
    /** @type {null|(() => void)} */
    let off = null;
    let dead = false;
    import('./logic/actions.js').then((m) => {
      if (!dead) off = m.registerNoteSource();
    });
    return () => {
      dead = true;
      if (off) off();
    };
  },
};
