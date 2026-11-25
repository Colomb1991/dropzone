// @ts-check
// App frame: route outlet with the gates of ARCHITECTURE 0.0 row 2.5, bottom navigation, moving lock,
// and the hosts that sit above every screen (overlay slot, alert card, toast, confirm dialog).
import { html, render, useEffect, useState, useErrorBoundary } from '../html.js';
import * as router from '../../core/router.js';
import * as store from '../../core/store.js';
import * as events from '../../core/events.js';
import * as env from '../../core/env.js';
import * as log from '../../core/log.js';
import * as session from '../../core/shift/session.js';
import { t } from '../../core/i18n.js';
import { useStore, useSetting, useLang, useLazy } from '../hooks.js';
import { Screen } from '../kit/screen.js';
import { Empty } from '../kit/empty.js';
import { ToastHost } from '../kit/toast.js';
import { ConfirmHost } from '../kit/dialog.js';
import { SlotOutlet } from '../kit/slot.js';
import { SectionContext } from '../kit/accent.js';
import { Nav, MORE_PATH } from './nav.js';
import { AlertHost } from './alert-host.js';
import { ErrorScreen } from './error-screen.js';
import { useMovingLock, lockTapHandler } from './moving-lock.js';
import { tabItems, sectionOf } from './registry-view.js';

const WELCOME_PATH = '/benvenuto';

/** Routes owned by the shell itself. */
export const SHELL_ROUTES = [
  { path: MORE_PATH, load: () => import('./more-screen.js'), titleKey: 'core.nav.more', chrome: 'tabs' },
];

/**
 * Gate order: viewer → open route → second window → iOS tab → onboarding → route.
 * @returns {null|'second-window'|string} null = show the route; a path = go there instead
 */
export function gateFor(route, ctx) {
  if (route.name === 'viewer' || route.def?.open || ctx.sandbox) return null;
  if (!ctx.primary) return 'second-window';
  if (!ctx.hasWelcome) return null;
  if (ctx.iosTab && !ctx.browserUseAccepted) return WELCOME_PATH;
  if (ctx.onboardedAt === null) return WELCOME_PATH;
  return null;
}

function useRoute() {
  const [route, setRoute] = useState(() => router.current());
  useEffect(() => {
    setRoute(router.current());
    return router.onChange((r) => setRoute(r));
  }, []);
  return route;
}

function RouteView({ route }) {
  const { Comp, error } = useLazy(route.def?.load);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 1000);
    return () => clearTimeout(id);
  }, []);
  if (error || !route.def) return html`<${ErrorScreen} titleKey="core.err.generic" />`;
  if (!Comp) return slow ? html`<div class="loading" role="status">${t('core.state.loading')}</div>` : null;
  // The screen learns which section it is: Screen puts that section's icon and colour in its header.
  return html`<${SectionContext.Provider} value=${sectionOf(route.def)}>
    <${Comp} params=${route.params} query=${route.query} route=${route} />
  <//>`;
}

function Boundary({ children }) {
  const [error] = useErrorBoundary((err) => log.error('render', err));
  return error ? html`<${ErrorScreen} />` : children;
}

function SecondWindow() {
  return html`<${Screen} title=${t('core.app.name')}>
    <${Empty} icon="info" title=${t('core.banner.secondWindow')} text=${t('ui.second.text')} />
  <//>`;
}

export function App() {
  const route = useRoute();
  const lang = useLang();
  const locked = useMovingLock();
  const primary = useStore((s) => s.primary);
  const sandbox = useStore((s) => s.sandbox);
  const [onboardedAt] = useSetting('onboardedAt');
  const [browserUseAccepted] = useSetting('browserUseAccepted');
  const [alertOpen, setAlertOpen] = useState(false);
  const [outdated, setOutdated] = useState(false);

  const gate = gateFor(route, {
    primary, sandbox, onboardedAt, browserUseAccepted, iosTab: env.isIosTab(),
    hasWelcome: router.resolve(router.href(WELCOME_PATH)).def?.path === WELCOME_PATH,
  });
  const redirect = gate !== null && gate !== 'second-window' ? gate : null;

  useEffect(() => {
    if (redirect) router.navigate(redirect, { replace: true });
  }, [redirect, route]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const page = route.def?.titleKey ? t(route.def.titleKey) : '';
    const app = t('core.app.name');
    document.title = page && page !== app ? t('ui.title', { page, app }) : app;
  }, [route.name, route.path, lang]);

  useEffect(() => {
    const offDb = events.on('db:outdated', () => setOutdated(true));
    // Sound and speech need a tap after a reload or an interruption: any tap while stopped re-arms them.
    const rearm = () => {
      const s = store.getState();
      if (s.shift && s.audio === 'locked' && !(s.moving && !s.passenger)) session.rearmAudio();
    };
    document.addEventListener('click', rearm, true);
    return () => {
      offDb();
      document.removeEventListener('click', rearm, true);
    };
  }, []);

  if (outdated) return html`<${ErrorScreen} titleKey="core.err.dbUpdated" />`;

  const chrome = gate === 'second-window' ? 'tabs' : (route.def?.chrome ?? 'back');
  const outletLocked = locked && !route.def?.whileMoving;
  const key = `${route.name}|${route.path}|${lang}|${gate ?? ''}`;
  return html`<div class="app" data-chrome=${chrome === 'none' ? 'none' : 'nav'} onClick=${lockTapHandler(outletLocked)}>
    <div class="app__outlet" key=${key} inert=${outletLocked} aria-disabled=${outletLocked ? 'true' : null}>
      <${Boundary}>
        ${gate === 'second-window' ? html`<${SecondWindow} />` : !redirect && html`<${RouteView} route=${route} />`}
      <//>
    </div>
    <${SlotOutlet} name="overlay" props=${{ route }} />
    <${Nav} tabs=${tabItems()} route=${route} locked=${locked} hidden=${chrome === 'none' || alertOpen || redirect !== null} />
    <${AlertHost} onOpenChange=${setAlertOpen} />
    <${ToastHost} />
    <${ConfirmHost} />
  </div>`;
}

/** @param {HTMLElement} el */
export function mountApp(el) {
  el.replaceChildren();
  render(html`<${App} />`, el);
}

/** Boot failure: one screen, in the user's language when the dictionaries could be loaded. */
export function mountFatal(el, titleKey) {
  el.replaceChildren();
  render(html`<${ErrorScreen} titleKey=${titleKey} />`, el);
}
