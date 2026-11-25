// @ts-check
import { html } from '../html.js';
import { Icon } from './icon.js';

/** @param {{label:string, icon?:string, pressed:boolean, onToggle:()=>void, disabled?:boolean}} props */
export function Chip({ label, icon, pressed, onToggle, disabled }) {
  return html`<button type="button" class="chip" aria-pressed=${String(Boolean(pressed))}
    disabled=${disabled || null} onClick=${onToggle}>
    ${pressed ? html`<${Icon} name="check" />` : icon && html`<${Icon} name=${icon} />`}
    <span>${label}</span>
  </button>`;
}

/** Wrapping row of chips. @param {{children:any, label?:string}} props */
export function Chips({ children, label }) {
  return html`<div class="chips" role="group" aria-label=${label ?? null}>${children}</div>`;
}

/** Not interactive. @param {{label:string, tone?:string, icon?:string}} props */
export function Tag({ label, tone, icon }) {
  return html`<span class="tag" data-tone=${tone ?? 'neutral'}>
    ${icon && html`<${Icon} name=${icon} />`}${label}
  </span>`;
}
