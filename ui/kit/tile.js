// @ts-check
import { html } from '../html.js';
import { Icon, IconBadge } from './icon.js';

/**
 * @param {{icon:string, label:string, value?:string, primary?:boolean, wide?:boolean, tone?:string,
 *   accent?:string|null, badge?:boolean, disabled?:boolean, reason?:string, onClick?:(e:Event)=>void,
 *   href?:string, external?:boolean}} props
 *   `accent`: the section the tile opens (ui/kit/accent.js): icon in a badge, soft wash, tinted
 *   hairline. `badge`: the icon in a badge also without an accent (it takes the tone).
 */
export function Tile({ icon, label, value, primary, wide, tone, accent, badge, disabled, reason, onClick, href,
  external }) {
  const cls = ['tile', primary && 'tile--primary', wide && 'tile--wide'].filter(Boolean).join(' ');
  const sub = disabled && reason ? reason : value;
  // The primary fill and the disabled fill say more than the section: they keep the tile to themselves.
  const tint = accent && !primary && !disabled ? accent : null;
  const body = html`
    ${accent || badge ? html`<${IconBadge} name=${icon} size="lg" />` : html`<${Icon} name=${icon} size=${32} />`}
    <span class="tile__text">
      <span class="tile__label">${label}</span>
      ${sub && html`<span class="tile__value">${sub}</span>`}
    </span>`;
  if (href && !disabled) {
    return html`<a class=${cls} data-tone=${tone ?? null} data-accent=${tint} href=${href}
      target=${external ? '_blank' : null} rel=${external ? 'noopener noreferrer' : null} onClick=${onClick}>${body}</a>`;
  }
  return html`<button type="button" class=${cls} data-tone=${tone ?? null} data-accent=${tint}
    disabled=${disabled || null} onClick=${disabled ? null : onClick}>${body}</button>`;
}

/** Two-column grid of tiles. */
export function Tiles({ children }) {
  return html`<div class="tiles">${children}</div>`;
}
