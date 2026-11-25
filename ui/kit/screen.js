// @ts-check
import { html, useEffect, useRef } from '../html.js';
import * as router from '../../core/router.js';
import { t } from '../../core/i18n.js';
import { Icon } from './icon.js';
import { BannerHost } from '../shell/banner-host.js';

/**
 * Header, banner slot, content, sticky bottom above the nav.
 * @param {{title:string, back?:boolean|string, tags?:any, sticky?:any, banner?:boolean, action?:any,
 *   children?:any}} props  `back`: true, or the fallback path; `banner:false` hides the banner slot
 */
export function Screen({ title, back, tags, sticky, banner = true, action, children }) {
  const h1 = useRef(/** @type {HTMLElement|null} */ (null));
  useEffect(() => {
    // A new screen starts at the top with its title focused (screen readers announce it).
    h1.current?.focus({ preventScroll: true });
  }, []);
  const goBack = () => router.back(typeof back === 'string' ? back : undefined);
  return html`<main class="page screen">
    <header class="screen__header">
      ${back && html`<button type="button" class="btn btn--ghost btn--icon screen__back"
        aria-label=${t('core.action.back')} onClick=${goBack}><${Icon} name="arrow-left" /></button>`}
      <h1 class="screen__title" tabindex="-1" ref=${h1}>${title}</h1>
      ${action}
    </header>
    ${tags && html`<div class="screen__tags">${tags}</div>`}
    ${banner && html`<${BannerHost} />`}
    <div class="screen__body">${children}</div>
    ${sticky && html`<div class="screen__sticky">${sticky}</div>`}
  </main>`;
}
