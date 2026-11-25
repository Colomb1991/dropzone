// @ts-check
// Manual changes on one pending stop: "Fai adesso", up, down, "Vai", remove.
import { html } from '../../../ui/html.js';
import { t, log } from '../../../core/api.js';
import { useAction } from '../../../ui/hooks.js';
import { Sheet, Button, toast } from '../../../ui/kit/index.js';
import { pendingStops } from '../logic/route.js';
import { makeNext, moveStop, removeStop, restoreStop } from '../logic/data.js';
import { stopLabel, sourceTags, SourceTags, GoButton, Known } from './common.js';

/**
 * @param {{route:import('../logic/route.js').Route, stopId:string|null, known:any[], navApp:string,
 *   moving:boolean, onClose:()=>void, onGo:(dest:object)=>void}} props
 */
export function StopSheet({ route, stopId, known, navApp, moving, onClose, onGo }) {
  const index = stopId ? route.stops.findIndex((s) => s.id === stopId && !s.done) : -1;
  const stop = index >= 0 ? route.stops[index] : null;
  const pending = pendingStops(route);
  const place = stop ? pending.findIndex((s) => s.id === stop.id) : -1;
  const act = useAction((fn) => fn());

  const now = () => act.run(async () => {
    await makeNext(stop.id);
    onClose();
    toast(t('giro.movedNext'), { icon: 'check' });
  });
  const move = (dir) => () => act.run(() => moveStop(stop.id, dir));
  const remove = () => act.run(async () => {
    const gone = stop;
    await removeStop(gone.id);
    onClose();
    toast(t('giro.removed'), { icon: 'trash-2', action: { label: t('core.action.undo'),
      onClick: () => restoreStop(gone, index).catch((err) => log.error('giro', err)) } });
  });

  return html`<${Sheet} open=${Boolean(stop)} title=${stop ? t('giro.stop.n', { n: index + 1 }) : t('giro.title')}
    onClose=${onClose}>
    ${stop && html`<div class="f-giro-sheet">
      <p class="f-giro-sheet__label">${stopLabel(stop)}</p>
      ${sourceTags(stop).length > 0 && html`<div class="cluster"><${SourceTags} stop=${stop} /></div>`}
      <${Known} notes=${known} />
      ${moving && html`<p class="t-body-m t-muted" role="status">${t('giro.sheet.moving')}</p>`}
      <${Button} block size="xl" icon="arrow-up-to-line" label=${t('giro.sheet.now')}
        disabled=${moving || place === 0} busy=${act.busy} onClick=${now} />
      <div class="btn-row">
        <${Button} variant="secondary" icon="chevron-up" label=${t('giro.sheet.up')}
          disabled=${moving || place <= 0} onClick=${move(-1)} />
        <${Button} variant="secondary" icon="chevron-down" label=${t('giro.sheet.down')}
          disabled=${moving || place === pending.length - 1} onClick=${move(1)} />
      </div>
      <${GoButton} block navApp=${navApp} onAsk=${onGo}
        dest=${{ lat: stop.lat, lon: stop.lon, label: stopLabel(stop) }} />
      <${Button} block variant="ghost" icon="trash-2" label=${t('giro.sheet.remove')} disabled=${moving}
        onClick=${remove} />
    </div>`}
  <//>`;
}
