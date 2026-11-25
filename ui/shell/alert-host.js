// @ts-check
// The proximity alert card, above everything (z 60). The presenter in core owns the queue and the
// timers; this component only draws what it is told.
import { html, useEffect, useState } from '../html.js';
import * as presenter from '../../core/alerts/presenter.js';
import * as engine from '../../core/alerts/proximity-engine.js';
import * as log from '../../core/log.js';
import { t } from '../../core/i18n.js';
import { AlertCard } from '../kit/alert-card.js';
import { PhotoView } from '../kit/photo-view.js';
import { toast } from '../kit/toast.js';

/** @param {{onOpenChange?:(open:boolean)=>void}} props */
export function AlertHost({ onOpenChange }) {
  const [cur, setCur] = useState(/** @type {any} */ (null));
  const [photo, setPhoto] = useState(/** @type {string|null} */ (null));
  useEffect(() => {
    presenter.setRenderer((model, state) => setCur(model ? { model, ...state } : null));
    return () => presenter.setRenderer(() => {});
  }, []);
  const open = cur !== null;
  useEffect(() => {
    if (onOpenChange) onOpenChange(open);
    if (!open) setPhoto(null);
  }, [open]);
  if (!cur) return null;
  const mute = () => {
    const id = cur.model.id;
    // The engine mutes the target until midnight when the card closes with 'mute'.
    presenter.dismiss('mute');
    toast(t('core.alert.muted'), { icon: 'bell-off', action: { label: t('core.action.undo'),
      onClick: () => {
        engine.muteTarget(id, null).catch((err) => log.error('alert', err));
      } } });
  };
  return html`
    <${AlertCard} key=${cur.model.id} model=${cur.model} index=${cur.index} total=${cur.total} moving=${cur.moving}
      speaking=${cur.speaking} closeAt=${cur.closeAt} onSeen=${() => presenter.dismiss('seen')} onMute=${mute}
      onReplay=${() => presenter.replay()} onOpenPhoto=${cur.model.photoId ? () => setPhoto(cur.model.photoId) : undefined} />
    ${photo && !cur.moving && html`<${PhotoView} mediaId=${photo} alt=${cur.model.title} onClose=${() => setPhoto(null)} />`}`;
}
