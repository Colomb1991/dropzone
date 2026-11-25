// @ts-check
import { html, useEffect, useLayoutEffect, useRef } from '../html.js';
import * as events from '../../core/events.js';
import * as store from '../../core/store.js';
import { t } from '../../core/i18n.js';
import { Icon } from './icon.js';
import { inOverlay, syncDialog } from './portal.js';

/**
 * Bottom sheet on a native <dialog>. Closes itself with onClose('moving') when driving turns fast.
 * @param {{open:boolean, title:string, onClose:(why:'user'|'moving')=>void, footer?:any,
 *   keepWhileMoving?:boolean, children?:any}} props
 */
export function Sheet({ open, title, onClose, footer, keepWhileMoving, children }) {
  const ref = useRef(/** @type {HTMLDialogElement|null} */ (null));
  const close = useRef(onClose);
  close.current = onClose;

  useLayoutEffect(() => {
    syncDialog(ref.current, open);
  }, [open]);
  useEffect(() => () => syncDialog(ref.current, false), []);
  useEffect(() => {
    if (!open || keepWhileMoving) return undefined;
    return events.on('driving:changed', (e) => {
      if (e.fast && !store.getState().passenger) close.current('moving');
    });
  }, [open, keepWhileMoving]);

  const onCancel = (e) => {
    e.preventDefault();
    close.current('user');
  };
  const onScrim = (e) => {
    if (e.target === ref.current) close.current('user');
  };
  return inOverlay(html`<dialog class="sheet" ref=${ref} aria-label=${title} onCancel=${onCancel} onClick=${onScrim}>
    ${open && html`
      <div class="sheet__header">
        <h2 class="sheet__title">${title}</h2>
        <button type="button" class="btn btn--ghost btn--icon" aria-label=${t('core.action.close')}
          onClick=${() => close.current('user')}><${Icon} name="x" /></button>
      </div>
      <div class="sheet__body">${children}</div>
      ${footer && html`<div class="sheet__footer">${footer}</div>`}`}
  </dialog>`);
}
