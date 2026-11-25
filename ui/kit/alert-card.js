// @ts-check
import { html, useMemo } from '../html.js';
import { t } from '../../core/i18n.js';
import * as format from '../../core/format.js';
import { now } from '../../core/clock.js';
import { useTick } from '../hooks.js';
import { Icon } from './icon.js';
import { Button } from './button.js';
import { Thumb } from './photo-view.js';

/**
 * Full-screen proximity alert (DESIGN 8.9). No buttons while moving: it closes by itself.
 * @param {{model:import('../../core/types.js').AlertCardModel, index:number, total:number, moving:boolean,
 *   speaking:boolean, closeAt:number, onSeen:()=>void, onMute:()=>void, onReplay:()=>void,
 *   onOpenPhoto?:()=>void}} props
 */
export function AlertCard({ model, index, total, moving, speaking, closeAt, onSeen, onMute, onReplay, onOpenPhoto }) {
  const at = useTick(1000);
  const drainMs = useMemo(() => Math.max(0, closeAt - now()), [model.id, closeAt]);
  const left = Math.max(0, Math.ceil((closeAt - at) / 1000));
  return html`<section class="alert-card" data-tone=${model.tone} role="alertdialog" aria-modal="true"
    aria-labelledby="ac-cat" aria-describedby="ac-text">
    <div class="alert-card__band">
      ${speaking && html`<span class="alert-card__speaking"><${Icon} name="volume-2" size=${32} /></span>`}
      ${total > 1 && html`<span class="alert-card__count">
        ${t('core.alert.queue', { n: index + 1, total })}
      </span>`}
      <${Icon} name=${model.icon} size=${96} />
      <h1 class="alert-card__category" id="ac-cat">${model.title}</h1>
      <span class="alert-card__distance">${format.distance(model.distM)}</span>
      <span class="alert-card__countdown" aria-hidden="true">${left}</span>
      <span class="alert-card__timer" key=${closeAt} style=${{ animationDuration: `${drainMs}ms` }}></span>
    </div>
    <div class="alert-card__body">
      ${model.prefix && html`<p class="alert-card__prefix">${model.prefix}</p>`}
      <p class="alert-card__text" id="ac-text">${model.text}</p>
      ${model.meta && html`<p class="alert-card__meta">${model.meta}</p>`}
      ${model.photoId && (moving || !onOpenPhoto
        ? html`<${Thumb} mediaId=${model.photoId} size=${96} />`
        : html`<button type="button" class="alert-card__photo-btn" aria-label=${t('core.alert.openPhoto')}
            onClick=${onOpenPhoto}><${Thumb} mediaId=${model.photoId} size=${96} /></button>`)}
    </div>
    <div class="alert-card__actions">
      ${moving
        ? html`<p class="alert-card__hint">${t('core.alert.autoClose')}</p>`
        : html`
          <${Button} variant="secondary" size="xl" icon="volume-2" label=${t('core.alert.replay')}
            disabled=${speaking || !model.speakText} onClick=${onReplay} />
          <${Button} variant="secondary" size="xl" icon="bell-off" label=${t('core.alert.mute')} onClick=${onMute} />
          <${Button} variant="primary" size="xl" block label=${t('core.alert.seen')} onClick=${onSeen} />`}
    </div>
  </section>`;
}
