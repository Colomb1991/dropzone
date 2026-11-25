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
  return html`<div role="status" aria-live="polite">
    <div class=${leaving ? 'toast is-leaving' : 'toast'} key=${id}>
      ${cur.icon && html`<${Icon} name=${cur.icon} />`}
      <span class="toast__text">${cur.text}</span>
      ${action && html`<button type="button" class="toast__action" onClick=${act}>${action.label}</button>`}
    </div>
  </div>`;
}
