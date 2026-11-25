// @ts-check
// Module entry: registry → database → settings → i18n → gates → render → service worker.
// The order below is the one in docs/handover/f0-core.md.
import { FEATURES, validateFeatures } from './features/registry.js';
import * as schema from './core/db/schema.js';
import * as db from './core/db/db.js';
import * as settings from './core/settings.js';
import * as router from './core/router.js';
import * as slots from './core/slots.js';
import * as store from './core/store.js';
import * as tick from './core/tick.js';
import * as log from './core/log.js';
import * as errors from './core/errors.js';
import * as session from './core/shift/session.js';
import * as backup from './core/data/backup.js';
import * as instance from './core/platform/instance.js';
import * as install from './core/platform/install.js';
import * as swClient from './core/sw-client.js';
import { initI18n, t } from './core/i18n.js';
import { toast } from './ui/kit/toast.js';
import { mountApp, mountFatal, SHELL_ROUTES } from './ui/shell/app.js';
import { setFeatures } from './ui/shell/registry-view.js';
import { startTheme } from './ui/shell/theme.js';

const uiLoader = { it: () => import('./ui/i18n/it.js'), en: () => import('./ui/i18n/en.js') };
const loaders = () => [uiLoader, ...FEATURES.map((f) => f.i18n).filter(Boolean)];

function mirrorLang() {
  return document.documentElement.lang === 'en' ? 'en' : 'it';
}

function addFeatureCss(href) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

async function boot() {
  const root = /** @type {HTMLElement} */ (document.getElementById('app'));
  errors.installGlobalHandlers();
  install.listen();

  for (const problem of validateFeatures(FEATURES)) log.warn('registry', problem);
  for (const f of FEATURES) {
    schema.registerStores(f.stores ?? []);
    settings.defineSettings(f.settingKeys ?? {});
    router.defineRoutes(f.routes ?? []);
    slots.register(f.id, f.slots ?? []);
    if (f.css) addFeatureCss(f.css);
  }
  router.defineRoutes(SHELL_ROUTES);
  setFeatures(FEATURES);

  await db.deleteDemoDatabase().catch((err) => log.error('boot', err));
  await db.openDb();
  await settings.loadSettings();
  await initI18n(settings.get('lang'), loaders());

  const primary = await instance.claimPrimary();
  // A waiting worker is applied before first render, also under an open shift: the shift is in the
  // database and session.resumeIfOpen() below picks it up after the reload. Never twice in a row.
  const updated = swClient.takeUpdated();
  if (await swClient.applyWaitingAtBoot({ justUpdated: updated }).catch(() => false)) return;

  tick.start();
  startTheme();
  if (primary) {
    backup.startChangeTracking();
    await session.resumeIfOpen().catch((err) => log.error('boot', err));
  }
  for (const f of FEATURES) {
    try {
      if (typeof f.start === 'function') f.start();
    } catch (err) {
      log.error('feature', err, { feature: f.id });
    }
  }

  const bootRoute = router.resolve(location.hash);
  router.start();
  mountApp(root);
  store.setState({ ready: true });
  if (updated) {
    // Once the first screen is up: the toast measures that screen's action bar to sit above it.
    const say = () => setTimeout(() => toast(t('core.update.done'), { icon: 'check' }), 300);
    Promise.resolve(bootRoute.def?.load?.()).then(say, say);
  }

  // A colleague who only opened an alert link gets no worker until they choose to keep the app.
  const viewerOnly = bootRoute.name === 'viewer' && settings.get('onboardedAt') === null;
  if (!viewerOnly) {
    swClient.register().then((ok) => ok && swClient.checkForUpdate(true)).catch((err) => log.error('sw', err));
  }
  db.storageInfo().catch((err) => log.error('boot', err));
}

boot().catch(async (err) => {
  log.error('boot', err);
  const root = /** @type {HTMLElement} */ (document.getElementById('app'));
  try {
    await initI18n(mirrorLang(), [uiLoader]);
  } catch (e) {
    log.error('boot', e);
  }
  mountFatal(root, errors.toUserKey(err) === 'core.err.generic' ? 'core.err.render' : errors.toUserKey(err));
});
