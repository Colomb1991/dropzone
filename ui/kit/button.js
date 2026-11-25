// @ts-check
import { html, useRef } from '../html.js';
import { Icon } from './icon.js';

function classes({ variant = 'primary', size = 'md', block, iconOnly }) {
  return ['btn', `btn--${variant}`, size === 'xl' && 'btn--xl', block && 'btn--block', iconOnly && 'btn--icon']
    .filter(Boolean).join(' ');
}

/**
 * @param {{variant?:'primary'|'secondary'|'danger'|'ghost', size?:'md'|'xl', block?:boolean, icon?:string,
 *   label:string, iconOnly?:boolean, disabled?:boolean, reason?:string, busy?:boolean,
 *   onClick?:(e:Event)=>void, autofocus?:boolean}} props
 */
export function Button(props) {
  const { icon, label, iconOnly, disabled, reason, busy, onClick, size, autofocus } = props;
  const lastAt = useRef(-Infinity);
  const click = (e) => {
    // Glove bounce: repeats within 300 ms are ignored (DESIGN 6).
    if (disabled || busy || e.timeStamp - lastAt.current < 300) return;
    lastAt.current = e.timeStamp;
    if (onClick) onClick(e);
  };
  const btn = html`<button type="button" class=${classes(props)} disabled=${disabled || null}
    aria-busy=${busy ? 'true' : null} aria-label=${iconOnly ? label : null} autofocus=${autofocus || null}
    onClick=${click}>
    ${icon && html`<${Icon} name=${icon} size=${size === 'xl' && !iconOnly ? 32 : 24} />`}
    ${!iconOnly && html`<span>${label}</span>`}
  </button>`;
  if (!(disabled && reason)) return btn;
  return html`<div class="stack">${btn}<p class="t-caption t-muted t-center">${reason}</p></div>`;
}

/**
 * A real link styled as a button.
 * @param {{href:string, external?:boolean, variant?:'primary'|'secondary'|'danger'|'ghost', size?:'md'|'xl',
 *   block?:boolean, icon?:string, label:string, onClick?:(e:Event)=>void}} props
 */
export function LinkButton(props) {
  const { href, external, icon, label, size, onClick } = props;
  return html`<a class=${classes(props)} href=${href} target=${external ? '_blank' : null}
    rel=${external ? 'noopener noreferrer' : null} onClick=${onClick}>
    ${icon && html`<${Icon} name=${icon} size=${size === 'xl' ? 32 : 24} />`}
    <span>${label}</span>
  </a>`;
}
