// @ts-check
import { html } from '../html.js';
import { Icon } from './icon.js';
import { Button } from './button.js';

/** @param {{icon:string, title:string, text?:string, action?:{label:string, onClick:(e:Event)=>void}}} props */
export function Empty({ icon, title, text, action }) {
  return html`<div class="empty">
    <${Icon} name=${icon} size=${96} />
    <h2 class="empty__title">${title}</h2>
    ${text && html`<p class="empty__text">${text}</p>`}
    ${action && html`<${Button} label=${action.label} onClick=${action.onClick} />`}
  </div>`;
}
