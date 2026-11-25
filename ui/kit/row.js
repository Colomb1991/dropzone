// @ts-check
import { html } from '../html.js';
import { Icon } from './icon.js';
import { Tag } from './chip.js';
import { Thumb } from './photo-view.js';

/** @param {{children:any, label?:string}} props */
export function List({ children, label }) {
  const items = (Array.isArray(children) ? children.flat() : [children]).filter((c) => c != null && c !== false);
  return html`<ul class="list" aria-label=${label ?? null}>${items.map((c) => html`<li>${c}</li>`)}</ul>`;
}

/**
 * @param {{icon?:string, tone?:string, accent?:string|null, title:string, sub?:string, value?:string,
 *   tags?:{label:string, tone?:string, icon?:string}[], thumbId?:string, chevron?:boolean, selected?:boolean,
 *   dim?:boolean, href?:string, external?:boolean, onClick?:(e:Event)=>void, trailing?:any,
 *   disabled?:boolean}} props  `accent`: the section the row opens (ui/kit/accent.js); its icon
 *   sits in a badge of that colour
 */
export function ListRow(props) {
  const { icon, tone, accent, title, sub, value, tags, thumbId, chevron, selected, dim, href, external, onClick,
    trailing, disabled } = props;
  const lead = thumbId
    ? html`<${Thumb} mediaId=${thumbId} size=${40} />`
    : (icon || selected !== undefined) && html`<span class="row__disc">
        <${Icon} name=${selected ? 'check' : (icon ?? 'map-pin')} />
      </span>`;
  const tappable = Boolean(href || onClick) && !disabled;
  const cls = ['row', !lead && 'row--plain', !tappable && 'row--static', dim && 'is-dim'].filter(Boolean).join(' ');
  const body = html`
    ${lead}
    <span class="row__text">
      <span class="row__title">${title}</span>
      ${sub && html`<span class="row__sub">${sub}</span>`}
      ${tags && tags.length > 0 && html`<span class="row__tags">
        ${tags.map((g) => html`<${Tag} ...${g} />`)}
      </span>`}
    </span>
    <span class="row__trail">
      ${value && html`<span class="num">${value}</span>`}
      ${trailing}
      ${chevron && html`<${Icon} name="chevron-right" />`}
    </span>`;
  const common = { class: cls, 'data-tone': tone ?? null, 'data-accent': lead && !thumbId ? (accent ?? null) : null,
    'aria-selected': selected === undefined ? null : String(selected) };
  if (href && tappable) {
    return html`<a ...${common} href=${href} target=${external ? '_blank' : null}
      rel=${external ? 'noopener noreferrer' : null} onClick=${onClick}>${body}</a>`;
  }
  if (tappable) return html`<button type="button" ...${common} onClick=${onClick}>${body}</button>`;
  return html`<div ...${common}>${body}</div>`;
}
