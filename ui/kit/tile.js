// @ts-check
import { html } from '../html.js';
import { Icon } from './icon.js';

/**
 * @param {{icon:string, label:string, value?:string, primary?:boolean, wide?:boolean, tone?:string,
 *   disabled?:boolean, reason?:string, onClick?:(e:Event)=>void, href?:string, external?:boolean}} props
 */
export function Tile({ icon, label, value, primary, wide, tone, disabled, reason, onClick, href, external }) {
  const cls = ['tile', primary && 'tile--primary', wide && 'tile--wide'].filter(Boolean).join(' ');
  const sub = disabled && reason ? reason : value;
  const body = html`
    <${Icon} name=${icon} size=${32} />
    <span class="tile__text">
      <span class="tile__label">${label}</span>
      ${sub && html`<span class="tile__value">${sub}</span>`}
    </span>`;
  if (href && !disabled) {
    return html`<a class=${cls} data-tone=${tone ?? null} href=${href} target=${external ? '_blank' : null}
      rel=${external ? 'noopener noreferrer' : null} onClick=${onClick}>${body}</a>`;
  }
  return html`<button type="button" class=${cls} data-tone=${tone ?? null} disabled=${disabled || null}
    onClick=${disabled ? null : onClick}>${body}</button>`;
}

/** Two-column grid of tiles. */
export function Tiles({ children }) {
  return html`<div class="tiles">${children}</div>`;
}
