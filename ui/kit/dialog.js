// @ts-check
import { html, useEffect, useLayoutEffect, useRef, useState } from '../html.js';
import { Icon } from './icon.js';
import { Button } from './button.js';
import { inOverlay, syncDialog } from './portal.js';

/**
 * @param {{open:boolean, icon?:string, tone?:string, title:string, text?:string,
 *   actions:{label:string, variant:'primary'|'secondary'|'danger'|'ghost', onClick:(e:Event)=>void}[],
 *   dismissible?:boolean, onClose?:()=>void, children?:any}} props
 */
export function Dialog({ open, icon, tone, title, text, actions, dismissible, onClose, children }) {
  const ref = useRef(/** @type {HTMLDialogElement|null} */ (null));
  useLayoutEffect(() => {
    syncDialog(ref.current, open);
  }, [open]);
  useEffect(() => () => syncDialog(ref.current, false), []);

  // Scrim and Esc do nothing on a confirm; on an info dialog they act like the last (safe) button.
  const dismiss = (e) => {
    const safe = onClose ?? actions[actions.length - 1]?.onClick;
    if (dismissible && safe) safe(e);
  };
  const onCancel = (e) => {
    e.preventDefault();
    dismiss(e);
  };
  const onScrim = (e) => {
    if (e.target === ref.current) dismiss(e);
  };
  return inOverlay(html`<dialog class="dialog" ref=${ref} role="alertdialog" aria-label=${title}
    data-tone=${tone ?? null} onCancel=${onCancel} onClick=${onScrim}>
    ${open && html`
      ${icon && html`<span class="dialog__icon"><${Icon} name=${icon} size=${48} /></span>`}
      <h2 class="dialog__title">${title}</h2>
      ${text && html`<p class="dialog__text">${text}</p>`}
      ${children}
      <div class="dialog__actions">
        ${actions.map((a) => html`<${Button} block variant=${a.variant} label=${a.label} onClick=${a.onClick} />`)}
      </div>`}
  </dialog>`);
}

/** @type {{opts:any, resolve:(v:boolean)=>void}[]} */
let pending = [];
/** @type {Set<() => void>} */
const hosts = new Set();
const notify = () => hosts.forEach((fn) => fn());

/**
 * Promise-based confirmation. The destructive button sits on top, the safe one under the thumb.
 * @param {{title:string, text?:string, confirm:string, cancel:string, danger?:boolean, icon?:string}} opts
 * @returns {Promise<boolean>}
 */
export function confirm(opts) {
  return new Promise((resolve) => {
    pending = [...pending, { opts, resolve }];
    notify();
  });
}

/** Rendered once by the shell. */
export function ConfirmHost() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    hosts.add(fn);
    return () => hosts.delete(fn);
  }, []);
  const cur = pending[0];
  if (!cur) return null;
  const answer = (v) => () => {
    pending = pending.slice(1);
    cur.resolve(v);
    notify();
  };
  const o = cur.opts;
  return html`<${Dialog} open icon=${o.icon} tone=${o.danger ? 'danger' : null} title=${o.title} text=${o.text}
    actions=${[
      { label: o.confirm, variant: o.danger ? 'danger' : 'primary', onClick: answer(true) },
      { label: o.cancel, variant: 'secondary', onClick: answer(false) },
    ]} />`;
}
