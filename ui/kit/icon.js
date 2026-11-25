// @ts-check
import { html } from '../html.js';

const SIZE_CLASS = { 24: 'icon', 32: 'icon icon--lg', 48: 'icon icon--xl', 96: 'icon icon--hero' };

/** @param {{name:string, size?:24|32|48|96, label?:string}} props */
export function Icon({ name, size = 24, label }) {
  return html`<svg class=${SIZE_CLASS[size] ?? 'icon'} aria-hidden=${label ? null : 'true'}
    role=${label ? 'img' : null} aria-label=${label ?? null} focusable="false">
    <use href=${`./assets/icons/sprite.svg#i-${name}`} />
  </svg>`;
}
