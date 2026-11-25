// @ts-check
import { html } from '../html.js';
import { t } from '../../core/i18n.js';
import { Icon } from './icon.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** '0742' → '07:42'; null while incomplete or not a time of day. */
export function keypadTime(value) {
  if (!/^\d{4}$/.test(value)) return null;
  const h = Number(value.slice(0, 2));
  const m = Number(value.slice(2));
  return h < 24 && m < 60 ? `${value.slice(0, 2)}:${value.slice(2)}` : null;
}

function shown(value, mode, mask) {
  if (mode === 'time') {
    const v = value.padEnd(4, '–');
    return `${v.slice(0, 2)}:${v.slice(2)}`;
  }
  if (mask) return '•'.repeat(value.length) || ' ';
  return value || ' ';
}

/**
 * 3 × 4 keys of 72 px. `value` is the string of digits typed so far; in mode 'time' it holds up to
 * four digits shown as HH:MM (convert with keypadTime).
 * @param {{value:string, max?:number, onChange:(v:string)=>void, onDone?:()=>void, mask?:boolean,
 *   mode?:'digits'|'time', label?:string}} props
 */
export function Keypad({ value, max, onChange, onDone, mask, mode = 'digits', label }) {
  const limit = mode === 'time' ? 4 : (max ?? 6);
  const ready = mode === 'time' ? keypadTime(value) !== null : value.length > 0;
  const press = (d) => () => {
    if (value.length < limit) onChange(value + d);
  };
  const key = (d) => html`<button type="button" class="btn btn--secondary keypad__key num" onClick=${press(d)}>${d}</button>`;
  return html`<div class="keypad" role="group" aria-label=${label ?? null}>
    <p class="keypad__value num" aria-live="polite">${shown(value, mode, mask)}</p>
    <div class="keypad__keys">
      ${KEYS.map(key)}
      <button type="button" class="btn btn--ghost keypad__key" aria-label=${t('core.action.delete')}
        disabled=${value.length === 0 || null} onClick=${() => onChange(value.slice(0, -1))}>
        <${Icon} name="delete" size=${32} />
      </button>
      ${key('0')}
      <button type="button" class="btn btn--primary keypad__key" aria-label=${t('core.action.done')}
        disabled=${!ready || !onDone || null} onClick=${onDone}>
        <${Icon} name="check" size=${32} />
      </button>
    </div>
  </div>`;
}
