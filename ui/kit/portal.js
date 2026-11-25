// @ts-check
import { createPortal } from '../html.js';

/** Sheets, dialogs and the photo viewer render here, outside the route outlet and its moving lock. */
export function overlayRoot() {
  let el = document.getElementById('overlays');
  if (!el) {
    el = document.createElement('div');
    el.id = 'overlays';
    document.body.appendChild(el);
  }
  return el;
}

/** @param {any} vnode */
export function inOverlay(vnode) {
  return typeof document === 'undefined' ? vnode : createPortal(vnode, overlayRoot());
}

/** Opens or closes a native <dialog> to follow `open`. @param {HTMLDialogElement|null} el */
export function syncDialog(el, open) {
  if (!el) return;
  if (open && !el.open) {
    if (typeof el.showModal === 'function') el.showModal();
    else el.setAttribute('open', '');
  } else if (!open && el.open) {
    if (typeof el.close === 'function') el.close();
    else el.removeAttribute('open');
  }
}
