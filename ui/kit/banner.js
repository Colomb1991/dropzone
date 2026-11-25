// @ts-check
import { html } from '../html.js';
import { t } from '../../core/i18n.js';
import { Icon } from './icon.js';

/**
 * @param {{tone:string, icon:string, text:string, action?:{label:string, onClick:(e:Event)=>void},
 *   onDismiss?:()=>void, pulse?:boolean}} props
 */
export function Banner({ tone, icon, text, action, onDismiss, pulse }) {
  return html`<div class=${pulse ? 'banner is-pulsing' : 'banner'} data-tone=${tone} role="status">
    <${Icon} name=${icon} />
    <span class="banner__text">${text}</span>
    ${action && html`<button type="button" class="btn btn--secondary" onClick=${action.onClick}>${action.label}</button>`}
    ${onDismiss && html`<button type="button" class="btn btn--ghost btn--icon" aria-label=${t('core.action.close')}
      onClick=${onDismiss}><${Icon} name="x" /></button>`}
  </div>`;
}
