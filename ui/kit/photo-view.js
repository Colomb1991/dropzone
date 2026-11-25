// @ts-check
import { html, useEffect, useLayoutEffect, useRef, useState } from '../html.js';
import * as media from '../../core/model/media.js';
import * as log from '../../core/log.js';
import { t } from '../../core/i18n.js';
import { Button } from './button.js';
import { inOverlay, syncDialog } from './portal.js';

/** blob: URL of a stored photo, revoked on unmount. @returns {string|null} */
function useMediaUrl(mediaId) {
  const [url, setUrl] = useState(/** @type {string|null} */ (null));
  useEffect(() => {
    let alive = true;
    /** @type {null|(() => void)} */
    let revoke = null;
    setUrl(null);
    media.mediaUrl(mediaId).then((m) => {
      if (!m) return;
      if (!alive) m.revoke();
      else {
        revoke = m.revoke;
        setUrl(m.url);
      }
    }, (err) => log.error('photo', err));
    return () => {
      alive = false;
      if (revoke) revoke();
    };
  }, [mediaId]);
  return url;
}

/** @param {{mediaId:string, size:40|96, alt?:string}} props */
export function Thumb({ mediaId, size = 40, alt = '' }) {
  const url = useMediaUrl(mediaId);
  const cls = `thumb thumb--${size === 96 ? 96 : 40}`;
  if (!url) return html`<span class=${cls}></span>`;
  return html`<img class=${cls} src=${url} alt=${alt} width=${size} height=${size} decoding="async" />`;
}

/** Full screen. @param {{mediaId:string, alt:string, onClose:()=>void, footer?:any}} props */
export function PhotoView({ mediaId, alt, onClose, footer }) {
  const url = useMediaUrl(mediaId);
  const ref = useRef(/** @type {HTMLDialogElement|null} */ (null));
  useLayoutEffect(() => {
    syncDialog(ref.current, true);
    return () => syncDialog(ref.current, false);
  }, []);
  const onCancel = (e) => {
    e.preventDefault();
    onClose();
  };
  return inOverlay(html`<dialog class="photo-view" ref=${ref} aria-label=${alt} onCancel=${onCancel}>
    ${url ? html`<img class="photo-view__img" src=${url} alt=${alt} />` : html`<span class="photo-view__img"></span>`}
    <div class="photo-view__bar">
      ${footer}
      <${Button} variant="secondary" block label=${t('core.action.close')} onClick=${onClose} />
    </div>
  </dialog>`);
}
