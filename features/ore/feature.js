// @ts-check
// Ore e riepilogo (SPEC 3.2, 6.4): month recap, edit and add a shift, CSV export, and the payslip
// comparison of SPEC 11.
import { validPayslips } from './logic/payslip.js';

export default {
  id: 'ore',
  routes: [
    { path: '/ore', load: () => import('./screens/month.js'), titleKey: 'ore.title', chrome: 'back' },
  ],
  nav: [{ place: 'more', order: 30, labelKey: 'ore.nav', icon: 'clock', to: '/ore' }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  css: new URL('./ore.css', import.meta.url).href,
  settingKeys: {
    // Hours read on the payslip, typed by the courier: {"YYYY-MM": {ord, extra}} in minutes, at most
    // 36 months. A setting, so it travels with the backup and needs no new store.
    'ore.payslip': { default: {}, validate: validPayslips },
  },
  slots: [
    // Home outside a shift: "Questa settimana".
    { slot: 'home.idle', order: 30, load: () => import('./slots/week-card.js') },
    // End card: "Questa settimana 43 h 10 · 1 h 10 oltre il contratto".
    { slot: 'shift.end', order: 10, provide: (ctx) => import('./slots/week-data.js').then((m) => m.endLines(ctx)) },
  ],
};
