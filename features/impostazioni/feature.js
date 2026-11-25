// @ts-check
// Impostazioni, Backup, Diagnostica. Renders the `diagnostics` and `data.counts` slots.
import { tn, backup, settings, clock } from '../../core/api.js';

/** End-card row "Ultimo backup 9 giorni fa", only while the weekly nudge applies. */
async function backupRow() {
  if (!backup.backupDue()) return [];
  const at = clock.now();
  const since = settings.get('lastBackupAt') ?? settings.get('onboardedAt') ?? at;
  const days = Math.max(1, Math.floor((at - since) / 86400000));
  return [{ kind: 'row', icon: 'download', text: tn('impostazioni.bk.endRow', days), to: '/impostazioni/backup' }];
}

export default {
  id: 'impostazioni',
  routes: [
    { path: '/impostazioni', load: () => import('./screens/settings.js'), titleKey: 'impostazioni.title',
      chrome: 'back' },
    { path: '/impostazioni/backup', load: () => import('./screens/backup.js'), titleKey: 'impostazioni.backup',
      chrome: 'back' },
    { path: '/impostazioni/diagnostica', load: () => import('./screens/diagnostics.js'),
      titleKey: 'impostazioni.diagnostica', chrome: 'back' },
  ],
  nav: [{ place: 'more', order: 90, labelKey: 'impostazioni.nav', icon: 'settings', to: '/impostazioni' }],
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  css: new URL('./impostazioni.css', import.meta.url).href,
  slots: [{ slot: 'shift.end', order: 90, provide: backupRow }],
};
