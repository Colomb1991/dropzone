// @ts-check
import { html } from '../html.js';
import * as env from '../../core/env.js';
import { t } from '../../core/i18n.js';
import { Icon } from '../kit/icon.js';
import { Button, LinkButton } from '../kit/button.js';

/**
 * Full-screen failure with a way out. SOS stays reachable.
 * @param {{titleKey?:string, textKey?:string, onRetry?:()=>void, sos?:boolean}} props
 */
export function ErrorScreen({ titleKey = 'core.err.render', textKey, onRetry, sos = true }) {
  return html`<main class="fatal" role="alert">
    <${Icon} name="triangle-alert" size=${96} />
    <h1 class="fatal__title">${t(titleKey)}</h1>
    ${textKey && html`<p class="fatal__text">${t(textKey)}</p>`}
    <div class="fatal__actions">
      <${Button} block size="xl" icon="refresh-cw" label=${t(onRetry ? 'core.action.retry' : 'core.action.reload')}
        onClick=${onRetry ?? (() => env.reloadApp())} />
      ${sos && html`<${LinkButton} block variant="danger" icon="phone" label=${t('ui.error.call112')} href="tel:112" />`}
    </div>
  </main>`;
}
