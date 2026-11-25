// @ts-check
// Giro (Beta): the route of today. The list is the default view; the map view puts the map above
// the same list, which is therefore also its fallback.
import { html, useState, useMemo } from '../../../ui/html.js';
import { t, tn, notes, router, format, cues } from '../../../core/api.js';
import { useLive, useLang, useStore, useSetting, useAction } from '../../../ui/hooks.js';
import {
  Screen, Button, Chips, Chip, List, Empty, Tag, Icon, NavigateSheet, confirm, toast,
} from '../../../ui/kit/index.js';
import { distM } from '../../../core/pure/geo-math.js';
import { nextStop, pendingStops, doneStops, progress, pendingLengthM, notesNear } from '../logic/route.js';
import {
  loadRoute, completeStop, undoComplete, sortRoute, clearRoute, positionNow,
} from '../logic/data.js';
import { useHere } from '../parts/common.js';
import { Progress, NextCard, StopRow } from '../parts/stop-views.js';
import { StopSheet } from '../parts/stop-sheet.js';
import { RouteMap } from '../parts/route-map.js';

const ADD_PATH = '/giro/aggiungi';

/** @param {{query?:Record<string,string>}} props */
export default function GiroScreen({ query }) {
  useLang();
  const mapView = query?.vista === 'mappa';
  const moving = useStore((s) => s.moving && !s.passenger);
  const [navApp] = useSetting('nav.app');
  const { data: route, loading } = useLive(['route'], loadRoute);
  const { data: allNotes } = useLive(['notes'], () => notes.listNotes());
  const here = useHere();
  const [dest, setDest] = useState(/** @type {any} */ (null));
  const [openId, setOpenId] = useState(/** @type {string|null} */ (null));
  const [showDone, setShowDone] = useState(false);

  const stops = route?.stops ?? [];
  // What the courier already knows at each stop: saved notes within 60 m.
  const known = useMemo(() => new Map(stops.map((s) => [s.id, s.done ? [] : notesNear(s, allNotes ?? [])])),
    [route, allNotes]);
  const knownAt = (id) => known.get(id) ?? [];

  const done = useAction(async (id) => {
    const res = await completeStop(id);
    if (!res) return;
    cues.playCue('saved');
    cues.haptic('saved');
    const p = progress(res.route);
    const undo = { label: t('core.action.undo'), onClick: () => undoLast.run() };
    if (p.done === p.total) toast(t('giro.finished'), { icon: 'check', action: undo });
    else toast(t(res.learned ? 'giro.done.learned' : 'giro.done.toast', p), { icon: 'check', action: undo });
  });
  const undoLast = useAction(async () => {
    if (await undoComplete()) toast(t('giro.undone'), { icon: 'undo-2' });
  });
  const sort = useAction(async () => {
    const fix = await positionNow();
    const res = await sortRoute(fix ? { lat: fix.lat, lon: fix.lon } : null);
    if (!fix) toast(t('giro.sorted.noFix'), { icon: 'info' });
    else if (res.afterM >= res.beforeM) toast(t('giro.sorted.same'), { icon: 'check' });
    else toast(t('giro.sorted', { dist: format.distance(res.afterM) }), { icon: 'route' });
  });
  const clear = useAction(async () => {
    const ok = await confirm({ icon: 'trash-2', danger: true, title: t('giro.clear.title'),
      text: tn('giro.clear.text', stops.length), confirm: t('giro.clear'), cancel: t('giro.clear.keep') });
    if (!ok) return;
    await clearRoute();
    toast(t('giro.cleared'), { icon: 'check' });
  });

  const setView = (v) => router.navigate('/giro', { replace: true, query: v === 'mappa' ? { vista: v } : {} });
  const add = () => router.navigate(ADD_PATH);
  const ask = (d) => {
    setOpenId(null);
    setDest(d);
  };
  const tags = html`<${Tag} label=${t('giro.beta')} icon="flask-conical" />`;

  if (!route) {
    return html`<${Screen} title=${t('giro.title')} back="/altro" tags=${tags}>
      ${!loading && html`<p class="t-body-m t-muted">${t('core.err.generic')}</p>`}
      ${loading && html`<p class="t-body-m t-muted" role="status">${t('core.state.loading')}</p>`}
    <//>`;
  }

  if (stops.length === 0) {
    const sticky = html`<${Button} block size="xl" icon="plus" label=${t('giro.add')} disabled=${moving}
      reason=${t('giro.add.moving')} onClick=${add} />`;
    return html`<${Screen} title=${t('giro.title')} back="/altro" tags=${tags} sticky=${sticky}>
      <${Empty} icon="route" title=${t('giro.empty.title')} text=${t('giro.empty.text')} />
      <p class="t-caption t-muted">${t('giro.caption')}</p>
    <//>`;
  }

  const next = nextStop(route);
  const pending = pendingStops(route);
  const finished = doneStops(route);
  const p = progress(route);
  const later = pending.slice(1);
  const numberOf = (id) => stops.findIndex((s) => s.id === id) + 1;
  const legTo = (i) => distM(pending[i - 1].lat, pending[i - 1].lon, pending[i].lat, pending[i].lon);

  const list = html`
    ${later.length > 0 && html`
      <h2 class="section-title">${t('giro.later')}</h2>
      <${List} label=${t('giro.later')}>
        ${later.map((s, i) => html`<${StopRow} key=${s.id} stop=${s} n=${numberOf(s.id)} legM=${legTo(i + 1)}
          known=${knownAt(s.id)} onOpen=${setOpenId} />`)}
      <//>`}
    ${finished.length > 0 && html`
      <div class="f-giro-section">
        <${Button} variant="ghost" icon=${showDone ? 'chevron-down' : 'chevron-right'}
          label=${showDone ? t('giro.doneList.hide') : tn('giro.doneList', finished.length)}
          onClick=${() => setShowDone(!showDone)} />
      </div>
      ${showDone && html`<${List} label=${tn('giro.doneList', finished.length)}>
        ${finished.map((s) => html`<${StopRow} key=${s.id} stop=${s} n=${numberOf(s.id)} legM=${null} known=${[]} />`)}
      <//>`}`}`;

  const sticky = html`<div class="f-giro-actions">
    <${Button} variant="secondary" iconOnly icon="plus" label=${t('giro.add')} disabled=${moving} onClick=${add} />
    <${Button} variant="secondary" icon="route" label=${t('giro.sort')} busy=${sort.busy}
      disabled=${moving || pending.length < 2} onClick=${sort.run} />
  </div>`;

  return html`<${Screen} title=${t('giro.title')} back="/altro" tags=${tags} sticky=${sticky}>
    <${Progress} done=${p.done} total=${p.total} leftM=${pending.length ? pendingLengthM(route, here) : null} />
    <${Chips} label=${t('giro.view')}>
      <${Chip} icon="list" label=${t('giro.view.list')} pressed=${!mapView} onToggle=${() => setView('elenco')} />
      <${Chip} icon="map" label=${t('giro.view.map')} pressed=${mapView} onToggle=${() => setView('mappa')} />
    <//>
    ${mapView && html`<${RouteMap} route=${route} here=${here} onPinTap=${setOpenId} />`}
    ${next
      ? html`<${NextCard} stop=${next} n=${numberOf(next.id)} here=${here} known=${knownAt(next.id)} navApp=${navApp}
          moving=${moving} busy=${done.busy} onGo=${ask} onDone=${() => done.run(next.id)} />`
      : html`<div class="f-giro-finish" role="status">
          <${Icon} name="check" size=${48} />
          <p class="f-giro-finish__title">${t('giro.finished')}</p>
          <p>${tn('giro.finished.text', p.total)}</p>
        </div>`}
    ${route.undo && html`<${Button} variant="ghost" icon="undo-2" label=${t('giro.undo')} busy=${undoLast.busy}
      disabled=${moving} onClick=${undoLast.run} />`}
    ${list}
    <div class="f-giro-foot">
      <p class="t-caption t-muted">${t('giro.caption')} ${t('giro.expires')}</p>
      <${Button} variant="ghost" icon="trash-2" label=${t('giro.clear')} disabled=${moving} busy=${clear.busy}
        onClick=${() => clear.run()} />
    </div>
    <${StopSheet} route=${route} stopId=${openId} known=${openId ? knownAt(openId) : []} navApp=${navApp}
      moving=${moving} onClose=${() => setOpenId(null)} onGo=${ask} />
    <${NavigateSheet} open=${Boolean(dest)} dest=${dest} onClose=${() => setDest(null)} />
  <//>`;
}
