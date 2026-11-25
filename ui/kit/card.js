// @ts-check
import { html } from '../html.js';
import { Icon } from './icon.js';

/**
 * @param {{title?:string, icon?:string, tone?:string, accent?:string|null,
 *   action?:{label:string, onClick:(e:Event)=>void}, href?:string, onClick?:(e:Event)=>void,
 *   stat?:{label:string, value:string}, children?:any}} props
 *   `accent`: the section the card belongs to (ui/kit/accent.js): label and icon in the accent,
 *   a soft wash in one corner, a tinted hairline.
 */
export function Card({ title, icon, tone, accent, action, href, onClick, stat, children }) {
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
  const common = { class: cls, 'data-tone': tone ?? null, 'data-accent': accent ?? null };
  if (href) return html`<a ...${common} href=${href} onClick=${onClick}>${body}</a>`;
  if (onClick) return html`<button type="button" ...${common} onClick=${onClick}>${body}</button>`;
  return html`<section ...${common}>${body}</section>`;
}
