// @ts-check
import { html, useEffect, useRef, useMemo } from '../html.js';
import * as store from '../../core/store.js';
import * as events from '../../core/events.js';
import { t } from '../../core/i18n.js';
import { Icon } from './icon.js';
import { toast } from './toast.js';

let fieldSeq = 0;
const useId = () => useMemo(() => `f${++fieldSeq}`, []);
const locked = () => {
  const s = store.getState();
  return s.moving && !s.passenger;
};

/**
 * Label above, control, helper or error under. Refuses focus while moving.
 * @param {{label:string, type?:'text'|'textarea'|'tel'|'time'|'password'|'number', value:string,
 *   onInput:(v:string)=>void, max?:number, helper?:string, error?:string, disabled?:boolean,
 *   placeholder?:string, inputmode?:string, autocomplete?:string}} props
 */
export function Field(props) {
  const { label, type = 'text', value, onInput, max, helper, error, disabled, placeholder, inputmode,
    autocomplete = 'off' } = props;
  const id = useId();
  const ref = useRef(/** @type {HTMLElement|null} */ (null));
  // An open field closes only when driving turns fast (ARCHITECTURE 0.0 row 2.17).
  useEffect(() => events.on('driving:changed', (e) => {
    if (e.fast && !store.getState().passenger && document.activeElement === ref.current) ref.current?.blur();
  }), []);
  const onFocus = (e) => {
    if (!locked()) return;
    e.target.blur();
    toast(t('core.field.moving'), { icon: 'triangle-alert' });
  };
  const common = {
    id, ref, class: 'field__control', value, disabled: disabled || null, placeholder: placeholder ?? null,
    maxlength: max ?? null, autocomplete, 'aria-invalid': error ? 'true' : null,
    'aria-describedby': error ? `${id}-e` : (helper || max ? `${id}-h` : null),
    onInput: (e) => onInput(e.target.value), onFocus,
  };
  return html`<div class="field">
    <label class="field__label" for=${id}>${label}</label>
    ${type === 'textarea'
      ? html`<textarea ...${common} rows="3"></textarea>`
      : html`<input ...${common} type=${type} inputmode=${inputmode ?? null} />`}
    ${error
      ? html`<p class="field__error" id=${`${id}-e`}><${Icon} name="triangle-alert" /><span>${error}</span></p>`
      : (helper || max) && html`<p class="field__help" id=${`${id}-h`}>
          <span>${helper ?? ''}</span>
          ${max && html`<span class="num">${t('core.field.count', { n: String(value ?? '').length, max })}</span>`}
        </p>`}
  </div>`;
}

/** @param {{label:string, value:any, options:{value:any, label:string}[], onChange:(v:any)=>void,
 *   disabled?:boolean, helper?:string}} props */
export function Select({ label, value, options, onChange, disabled, helper }) {
  const id = useId();
  const pick = (e) => onChange(options[e.target.selectedIndex]?.value);
  return html`<div class="field">
    <label class="field__label" for=${id}>${label}</label>
    <select id=${id} class="field__control" disabled=${disabled || null} onChange=${pick}>
      ${options.map((o) => html`<option value=${String(o.value)} selected=${o.value === value}>${o.label}</option>`)}
    </select>
    ${helper && html`<p class="field__help"><span>${helper}</span></p>`}
  </div>`;
}

/** @param {{label:string, value:number, min:number, max:number, step:number, format?:(n:number)=>string,
 *   onChange:(n:number)=>void, lessLabel?:string, moreLabel?:string}} props */
export function Stepper({ label, value, min, max, step, format, onChange, lessLabel = '−', moreLabel = '+' }) {
  const move = (d) => () => onChange(Math.min(max, Math.max(min, Math.round((value + d) / step) * step)));
  return html`<div class="field" role="group" aria-label=${label}>
    <span class="field__label">${label}</span>
    <div class="stepper">
      <button type="button" class="btn btn--secondary btn--icon" aria-label=${lessLabel} disabled=${value <= min || null}
        onClick=${move(-step)}><${Icon} name="minus" /></button>
      <span class="stepper__value" aria-live="polite">${format ? format(value) : String(value)}</span>
      <button type="button" class="btn btn--secondary btn--icon" aria-label=${moreLabel} disabled=${value >= max || null}
        onClick=${move(step)}><${Icon} name="plus" /></button>
    </div>
  </div>`;
}

/** Slider over fixed stops (alert radius). @param {{label:string, value:number, stops:number[],
 *   format:(n:number)=>string, onChange:(n:number)=>void}} props */
export function Range({ label, value, stops, format, onChange }) {
  const id = useId();
  const index = Math.max(0, stops.indexOf(value));
  return html`<div class="field">
    <label class="field__label" for=${id}>${label}</label>
    <div class="range">
      <input id=${id} type="range" min="0" max=${stops.length - 1} step="1" value=${index}
        aria-valuetext=${format(value)} onInput=${(e) => onChange(stops[Number(e.target.value)])} />
      <span class="range__value">${format(value)}</span>
    </div>
  </div>`;
}
