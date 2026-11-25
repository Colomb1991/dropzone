// @ts-check
import { html } from '../html.js';

const FILES = {
  hero: 'art/hero.jpg', path: 'art/path.jpg', guard: 'art/guard.jpg',
  zone: 'onboarding/zone.jpg', shift: 'onboarding/shift.jpg', privacy: 'onboarding/privacy.jpg',
};

/**
 * One of the six illustrations, in its 4:3 box (DECISIONS 11: cover, radius 24 px, never stretched,
 * never with text on top). `alt` stays empty when the screen text already says the same.
 * @param {{name:'hero'|'path'|'guard'|'zone'|'shift'|'privacy', alt?:string}} props
 */
export function Art({ name, alt = '' }) {
  return html`<img class="art" src=${`./assets/${FILES[name] ?? FILES.hero}`} alt=${alt} width="1000" height="750"
    decoding="async" />`;
}
