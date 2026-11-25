// @ts-check
import { html } from '../html.js';

const SIZE_CLASS = { 24: 'icon', 32: 'icon icon--lg', 48: 'icon icon--xl', 96: 'icon icon--hero' };
const BADGE_CLASS = { sm: 'badge badge--sm', md: 'badge', lg: 'badge badge--lg' };

/** @param {{name:string, size?:24|32|48|96, label?:string}} props */
export function Icon({ name, size = 24, label }) {
  return html`<svg class=${SIZE_CLASS[size] ?? 'icon'} aria-hidden=${label ? null : 'true'}
    role=${label ? 'img' : null} aria-label=${label ?? null} focusable="false">
    <use href=${`./assets/icons/sprite.svg#i-${name}`} />
  </svg>`;
}

/**
 * An icon in a rounded badge: filled with the accent at low alpha, drawn in the accent. Without
 * `accent` it takes the colours of the accent or tone scope it sits in.
 * @param {{name:string, accent?:string|null, size?:'sm'|'md'|'lg', class?:string}} props
 */
export function IconBadge({ name, accent, size = 'md', class: extra }) {
  const cls = extra ? `${BADGE_CLASS[size] ?? 'badge'} ${extra}` : (BADGE_CLASS[size] ?? 'badge');
  return html`<span class=${cls} data-accent=${accent ?? null}><${Icon} name=${name} /></span>`;
}
