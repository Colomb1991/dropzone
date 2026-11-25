// @ts-check
import { html } from '../html.js';
import { Icon } from './icon.js';

/**
 * @param {{title?:string, icon?:string, tone?:string, action?:{label:string, onClick:(e:Event)=>void},
 *   href?:string, onClick?:(e:Event)=>void, stat?:{label:string, value:string}, children?:any}} props
 */
export function Card({ title, icon, tone, action, href, onClick, stat, children }) {
  const tappable = Boolean(href || onClick);
  const cls = ['card', tappable && 'card--action', stat && 'card--stat'].filter(Boolean).join(' ');
  const head = title && html`<h2 class="card__title">
    ${icon && html`<${Icon} name=${icon} />`}<span>${title}</span>
  </h2>`;
  const body = html`
    ${action && !tappable
      ? html`<div class="card__head">${head}
          <button type="button" class="btn btn--ghost card__action" onClick=${action.onClick}>${action.label}</button>
        </div>`
      : head}
    ${stat && html`<span class="card__label">${stat.label}</span>
      <span class="card__value num">${stat.value}</span>`}
    ${children != null && html`<div class="card__body">${children}</div>`}
    ${tappable && html`<span class="card__chevron"><${Icon} name="chevron-right" /></span>`}`;
  if (href) return html`<a class=${cls} data-tone=${tone ?? null} href=${href} onClick=${onClick}>${body}</a>`;
  if (onClick) {
    return html`<button type="button" class=${cls} data-tone=${tone ?? null} onClick=${onClick}>${body}</button>`;
  }
  return html`<section class=${cls} data-tone=${tone ?? null}>${body}</section>`;
}
