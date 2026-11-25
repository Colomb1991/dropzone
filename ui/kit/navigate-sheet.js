// @ts-check
import { html, useState } from '../html.js';
import * as handoff from '../../core/platform/handoff.js';
import * as settings from '../../core/settings.js';
import * as log from '../../core/log.js';
import { t } from '../../core/i18n.js';
import { useSetting, useStore } from '../hooks.js';
import { Sheet } from './sheet.js';
import { LinkButton } from './button.js';
import { Toggle } from './toggle.js';

/**
 * "Portami lì": real links to the navigator apps. Honours `nav.app` (the remembered app comes first,
 * as the primary button).
 * @param {{open:boolean, dest:{lat:number, lon:number, label?:string}, walk?:boolean,
 *   onClose:(why?:string)=>void}} props
 */
export function NavigateSheet({ open, dest, walk, onClose }) {
  const [saved] = useSetting('nav.app');
  const sandbox = useStore((s) => s.sandbox);
  const [remember, setRemember] = useState(true);
  const apps = handoff.navApps();
  const first = apps.includes(saved) ? saved : null;
  const ordered = first ? [first, ...apps.filter((a) => a !== first)] : apps;
  const pick = (app) => () => {
    if (remember && saved !== app) settings.set('nav.app', app).catch((err) => log.error('nav', err));
    onClose('user');
  };
  return html`<${Sheet} open=${open} title=${dest?.label || t('core.action.takeMe')} onClose=${onClose}>
    ${sandbox
      ? html`<p>${t('core.nav.sandbox')}</p>`
      : open && dest && html`
        ${ordered.map((app) => html`<${LinkButton} external block size="xl" icon="navigation"
          variant=${app === (first ?? ordered[0]) ? 'primary' : 'secondary'} label=${t(`core.nav.${app}`)}
          href=${handoff.navUrl(app, dest.lat, dest.lon, { walk })} onClick=${pick(app)} />`)}
        <${Toggle} label=${t('ui.nav.remember')} checked=${remember} onChange=${setRemember} />`}
  <//>`;
}
