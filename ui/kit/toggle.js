// @ts-check
import { html } from '../html.js';

/**
 * The whole row is the label.
 * @param {{label:string, sub?:string, checked:boolean, onChange:(v:boolean)=>void, disabled?:boolean,
 *   reason?:string}} props
 */
export function Toggle({ label, sub, checked, onChange, disabled, reason }) {
  const line = disabled && reason ? reason : sub;
  return html`<label class="row row--plain">
    <span class="row__text">
      <span class="row__title">${label}</span>
      ${line && html`<span class="row__sub">${line}</span>`}
    </span>
    <input type="checkbox" role="switch" class="toggle" checked=${Boolean(checked)} disabled=${disabled || null}
      onChange=${(e) => onChange(e.target.checked)} />
  </label>`;
}
