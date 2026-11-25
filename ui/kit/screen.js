// @ts-check
import { html, useEffect, useRef, useContext } from '../html.js';
import * as router from '../../core/router.js';
import { t } from '../../core/i18n.js';
import { Icon, IconBadge } from './icon.js';
import { SectionContext, sectionAccent } from './accent.js';
import { BannerHost } from '../shell/banner-host.js';

/**
 * Header, banner slot, content, sticky bottom above the nav.
 * @param {{title:string, back?:boolean|string, tags?:any, sticky?:any, banner?:boolean, action?:any,
 *   dense?:boolean, icon?:string|false, accent?:string|null, children?:any}} props  `back`: true, or
 *   the fallback path; `banner:false` hides the banner slot; `dense`: tighter gaps, for the one
 *   screen that must fit a small phone (shift home). `icon` and `accent`: the badge next to the
 *   title. The first screen of a section gets its own from the shell (icon of its row in "Altro",
 *   accent of ui/kit/accent.js); pass them only to change that, `icon:false` for no badge.
 */
export function Screen({ title, back, tags, sticky, banner = true, action, dense, icon, accent, children }) {
  const h1 = useRef(/** @type {HTMLElement|null} */ (null));
  const section = useContext(SectionContext);
  useEffect(() => {
    // A new screen starts at the top with its title focused (screen readers announce it).
    h1.current?.focus({ preventScroll: true });
  }, []);
  const goBack = () => router.back(typeof back === 'string' ? back : undefined);
  // The section's colour, where the courier looks first. Neutral sections carry no colour: no badge.
  const tint = accent ?? sectionAccent(section?.id);
  const mark = icon === false ? null : (icon ?? (section?.root ? section.icon : null));
  const badge = mark && tint && tint !== 'neutral';
  return html`<main class=${dense ? 'page screen screen--dense' : 'page screen'}>
    <header class="screen__header">
      ${back && html`<button type="button" class="btn btn--ghost btn--icon screen__back"
        aria-label=${t('core.action.back')} onClick=${goBack}><${Icon} name="arrow-left" /></button>`}
      ${badge && html`<${IconBadge} name=${mark} accent=${tint} class="screen__badge" />`}
      <h1 class="screen__title" tabindex="-1" ref=${h1}>${title}</h1>
      ${action}
    </header>
    ${tags && html`<div class="screen__tags">${tags}</div>`}
    ${banner && html`<${BannerHost} />`}
    <div class="screen__body">${children}</div>
    ${sticky && html`<div class="screen__sticky">${sticky}</div>`}
  </main>`;
}
