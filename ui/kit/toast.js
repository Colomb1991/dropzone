// @ts-check
import { html, useEffect, useState } from '../html.js';
import { Icon } from './icon.js';

/** @type {{id:number, text:string, icon?:string, action?:{label:string, onClick:()=>void}, ms:number}|null} */
let cur = null;
let seq = 0;
/** @type {Set<() => void>} */
const hosts = new Set();
const notify = () => hosts.forEach((fn) => fn());

/**
 * One at a time: a new toast replaces the old. 5 s, 8 s with an action.
 * @param {string} text @param {{icon?:string, action?:{label:string, onClick:()=>void}, ms?:number}} [opts]
 */
export function toast(text, opts = {}) {
  cur = { id: ++seq, text, icon: opts.icon, action: opts.action, ms: opts.ms ?? (opts.action ? 8000 : 5000) };
  notify();
}

/**
 * Pixels from the bottom of the window to the top of the screen's sticky action bar, or null when
 * there is none. The toast sits above the bar: it must never cover "Scrivi" and "Foto", which live
 * there for the same 8 seconds as the toast "Nota salvata".
 */
function barLift() {
  try {
    const bar = document.querySelector('.screen__sticky');
    if (!bar || typeof bar.getBoundingClientRect !== 'function') return null;
    const top = bar.getBoundingClientRect().top;
    return top > 0 && top < window.innerHeight ? Math.round(window.innerHeight - top) : null;
  } catch (err) {
    return null;
  }
}

/** Rendered once by the shell. */
export function ToastHost() {
  const [, bump] = useState(0);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    hosts.add(fn);
    return () => hosts.delete(fn);
  }, []);
  const id = cur?.id ?? 0;
  useEffect(() => {
    setLeaving(false);
    if (!cur) return undefined;
    const mine = cur.id;
    const drop = () => {
      if (cur && cur.id === mine) {
        cur = null;
        notify();
      }
    };
    const out = setTimeout(() => setLeaving(true), cur.ms);
    const gone = setTimeout(drop, cur.ms + 140);
    return () => {
      clearTimeout(out);
      clearTimeout(gone);
    };
  }, [id]);
  if (!cur) return html`<div role="status" aria-live="polite"></div>`;
  const action = cur.action;
  const act = () => {
    cur = null;
    notify();
    if (action) action.onClick();
  };
  const lift = barLift();
  return html`<div role="status" aria-live="polite">
    <div class=${leaving ? 'toast is-leaving' : 'toast'} key=${id} style=${lift === null ? null : { bottom: `${lift + 8}px` }}>
      ${cur.icon && html`<${Icon} name=${cur.icon} />`}
      <span class="toast__text">${cur.text}</span>
      ${action && html`<button type="button" class="toast__action" onClick=${act}>${action.label}</button>`}
    </div>
  </div>`;
}
