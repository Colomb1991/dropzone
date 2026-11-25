// @ts-check
// How stops are shown: the progress, the large next stop, the one-line rows.
import { html } from '../../../ui/html.js';
import { t, tn, format } from '../../../core/api.js';
import { Button, Icon } from '../../../ui/kit/index.js';
import { distM } from '../../../core/pure/geo-math.js';
import { stopLabel, noteLine, sourceTags, SourceTags, GoButton, Known, KnownIcons } from './common.js';

/** @typedef {import('../logic/route.js').Stop} Stop */

/**
 * "12 di 40", a bar, and what is left.
 * @param {{done:number, total:number, leftM:number|null}} props
 */
export function Progress({ done, total, leftM }) {
  const left = total - done;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return html`<div class="f-giro-progress">
    <div class="f-giro-progress__row">
      <p class="f-giro-progress__count num" aria-label=${`${t('giro.progress.label')}: ${t('giro.progress', { done, total })}`}>
        <strong>${done}</strong> ${t('giro.progress.of', { total })}
      </p>
      ${left > 0 && html`<p class="f-giro-progress__left">
        ${tn('giro.progress.left', left)}${leftM !== null && leftM >= 50
          && html`<br />${t('giro.progress.dist', { dist: format.distance(leftM) })}`}
      </p>`}
    </div>
    <div class="f-giro-bar" role="progressbar" aria-label=${t('giro.progress.label')} aria-valuemin="0"
      aria-valuemax=${total} aria-valuenow=${done}>
      <span class="f-giro-bar__fill" style=${{ width: `${pct}%` }}></span>
    </div>
  </div>`;
}

/**
 * The next stop, large: where, how far, what I know there, "Vai" and "Fatto".
 * @param {{stop:Stop, n:number, here:{lat:number, lon:number}|null, known:any[], navApp:string, moving:boolean,
 *   busy:boolean, onGo:(dest:object)=>void, onDone:()=>void}} props
 */
export function NextCard({ stop, n, here, known, navApp, moving, busy, onGo, onDone }) {
  const away = here ? distM(here.lat, here.lon, stop.lat, stop.lon) : null;
  const tagged = sourceTags(stop).length > 0;
  return html`<section class="f-giro-next" aria-label=${t('giro.next')}>
    <div class="f-giro-next__head">
      <span class="f-giro-num f-giro-num--next">${n}</span>
      <div>
        <p class="f-giro-next__kicker">${t('giro.next')}</p>
        <h2 class="f-giro-next__label">${stopLabel(stop)}</h2>
        ${(away !== null || tagged) && html`<p class="f-giro-next__meta">
          ${away !== null && html`<span class="num">${t('giro.next.away', { dist: format.distance(away) })}</span>`}
          <${SourceTags} stop=${stop} />
        </p>`}
      </div>
    </div>
    <${Known} notes=${known} />
    <div class="btn-row">
      <${GoButton} size="xl" variant="primary" navApp=${navApp} onAsk=${onGo}
        dest=${{ lat: stop.lat, lon: stop.lon, label: stopLabel(stop) }} />
      <${Button} size="xl" variant="secondary" icon="check" label=${t('core.action.done')} busy=${busy}
        disabled=${moving} reason=${t('giro.done.moving')} onClick=${onDone} />
    </div>
  </section>`;
}

/**
 * One stop on one line. Pending stops open their sheet; done ones are dimmed and still.
 * @param {{stop:Stop, n:number, legM:number|null, known:any[], onOpen?:(id:string)=>void}} props
 *   `legM`: straight line from the stop before it
 */
export function StopRow({ stop, n, legM, known, onOpen }) {
  const body = html`
    <span class="row__disc f-giro-num">${n}</span>
    <span class="row__text">
      <span class="row__title">${stopLabel(stop)}</span>
      ${known.length > 0 && html`<span class="row__sub">${noteLine(known[0])}</span>`}
      ${(known.length > 0 || sourceTags(stop).length > 0) && html`<span class="row__tags">
        <${KnownIcons} notes=${known} /><${SourceTags} stop=${stop} />
      </span>`}
    </span>
    <span class="row__trail">
      ${!stop.done && legM !== null && html`<span class="num">${format.distance(legM)}</span>`}
      <${Icon} name=${stop.done ? 'check' : 'chevron-right'} label=${stop.done ? t('giro.stop.done') : undefined} />
    </span>`;
  if (stop.done || !onOpen) return html`<div class="row row--static is-dim">${body}</div>`;
  return html`<button type="button" class="row" onClick=${() => onOpen(stop.id)}>${body}</button>`;
}
