// @ts-check
// "Guarda come funziona": the 45-second scripted demo. Runs in the sandbox; exit reloads the page.
import { notes, log } from '../../core/api.js';

/** Home tile, while the user has fewer than 5 notes (SPEC 2.4). */
async function homeTile() {
  const count = await notes.countNotes().catch(() => {
    log.warn('demo', 'count-failed');
    return 0;
  });
  return count < 5 ? [{ icon: 'play', labelKey: 'demo.nav', to: '/demo' }] : [];
}

export default {
  id: 'demo',
  routes: [
    // whileMoving: the simulated van drives, and "Esci" must stay reachable.
    { path: '/demo', load: () => import('./screens/demo.js'), titleKey: 'demo.title', chrome: 'none', open: true,
      whileMoving: true },
  ],
  nav: [{ place: 'more', order: 70, labelKey: 'demo.nav', icon: 'play', to: '/demo' }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  css: new URL('./demo.css', import.meta.url).href,
  slots: [{ slot: 'home.tiles', order: 30, provide: homeTile }],
};
