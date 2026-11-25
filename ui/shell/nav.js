// @ts-check
import { html } from '../html.js';
import * as router from '../../core/router.js';
import * as backup from '../../core/data/backup.js';
import { t } from '../../core/i18n.js';
import { useStore, useTick } from '../hooks.js';
import { Icon } from '../kit/icon.js';

export const MORE_PATH = '/altro';

/** @param {string} path @param {{to:string}[]} tabs @returns {string} the `to` of the active item */
export function activeTab(path, tabs) {
  const hit = tabs.find((n) => (n.to === '/' ? path === '/' : path === n.to || path.startsWith(`${n.to}/`)));
  return hit ? hit.to : MORE_PATH;
}

/**
 * Bottom bar: the four feature tabs (SPEC 2.1) plus "Altro".
 * @param {{tabs:any[], route:import('../../core/router.js').Route, locked:boolean, hidden:boolean}} props
 */
export function Nav({ tabs, route, locked, hidden }) {
  const updateReady = useStore((s) => s.updateReady);
  useTick(60000);
  const items = [
    ...tabs,
    { to: MORE_PATH, icon: 'ellipsis', labelKey: 'core.nav.more', badge: () => updateReady || backup.backupDue() },
  ];
  const active = route.name === 'viewer' ? '' : activeTab(route.path, tabs);
  return html`<nav class="nav" aria-label=${t('ui.nav.label')} hidden=${hidden}>
    ${items.map((n) => {
      // SOS is never locked: its route is registered with whileMoving.
      const off = locked && !router.resolve(router.href(n.to)).def?.whileMoving;
      let badge = false;
      try {
        badge = n.badge ? n.badge() === true : false;
      } catch (err) {
        badge = false;
      }
      return html`<a class="nav__item" href=${router.href(n.to)} data-tone=${n.tone ?? null}
        aria-current=${active === n.to ? 'page' : null} aria-disabled=${off ? 'true' : null} inert=${off}>
        <span class="nav__pill">
          <${Icon} name=${n.icon} />
          ${badge && html`<span class="nav__badge"></span>`}
        </span>
        <span class="nav__label">${t(n.labelKey)}</span>
      </a>`;
    })}
  </nav>`;
}
