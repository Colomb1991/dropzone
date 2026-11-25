// @ts-check
// Ritmo (SPEC 11): the courier's own forecast for the shift. Counts typed two or three times a
// shift (or one tap per delivery in the +1 screen) become a time back at the depot and the margin
// for the break. The counts live in the `kv` store for the running shift only and are removed when
// it ends: no new store, nothing in the backup, no statistics kept.
import { validReturnMin, DEFAULT_RETURN_MIN } from './logic/pace.js';

export default {
  id: 'ritmo',
  routes: [
    { path: '/ritmo', load: () => import('./screens/ritmo.js'), titleKey: 'ritmo.title', chrome: 'back' },
    { path: '/ritmo/conta', load: () => import('./screens/count.js'), titleKey: 'ritmo.plus.title', chrome: 'back' },
  ],
  nav: [{ place: 'more', order: 32, labelKey: 'ritmo.nav', icon: 'gauge', to: '/ritmo' }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  settingKeys: {
    // "Strada per il magazzino": minutes from the last delivery back to the depot, 0 to 90.
    'ritmo.returnMin': { default: DEFAULT_RETURN_MIN, validate: validReturnMin },
  },
  slots: [
    { slot: 'shift.context', order: 20, watch: ['kv', 'settings'],
      provide: () => import('./slots/shift-card.js').then((m) => m.contextRows()) },
  ],
  start() {
    let offs = [];
    let stopped = false;
    Promise.all([import('../../core/api.js'), import('./logic/data.js')]).then(([api, data]) => {
      if (stopped) return;
      // The counts belong to one shift: a new shift starts clean, a closed one leaves nothing behind.
      offs = [api.events.on('shift:started', data.clearPace), api.events.on('shift:ended', data.clearPace)];
    });
    return () => {
      stopped = true;
      offs.forEach((off) => off());
    };
  },
};
