// @ts-check
import { html } from '../html.js';
import * as env from '../../core/env.js';
import { t } from '../../core/i18n.js';
import { Sheet } from '../kit/sheet.js';
import { Button } from '../kit/button.js';

/** "Come attivare la posizione" (SPEC 3.3). @param {{onClose:()=>void}} props */
export function LocationHelp({ onClose }) {
  const os = env.os();
  return html`<${Sheet} open title=${t('ui.loc.title')} onClose=${onClose}
    footer=${html`<${Button} block label=${t('core.action.understood')} onClick=${onClose} />`}>
    ${os !== 'android' && html`<p class="t-body-m">${t('ui.loc.ios')}</p>`}
    ${os !== 'ios' && html`<p class="t-body-m">${t('ui.loc.android')}</p>`}
  <//>`;
}
