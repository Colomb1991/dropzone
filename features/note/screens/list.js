// @ts-check
// Note: list first, map second; the list is also the fallback of the map (SPEC 3.2).
import { html, useState, useEffect, useMemo, useRef } from '../../../ui/html.js';
import { t, notes, geo, settings, router, slots, events, clock, log } from '../../../core/api.js';
import { useLive, useLang, useTick } from '../../../ui/hooks.js';
import { Screen, Chip, Chips, List, Button, Empty, MapView } from '../../../ui/kit/index.js';
import { NOTE_CATS, CATEGORIES, catLabelKey, category } from '../../../core/pure/catalog.js';
import { isScheduleActive } from '../../../core/pure/schedule.js';
import { filterNotes, sortNotes, noteTitle, FILTER_INCOMPLETE } from '../logic/note-view.js';
import { NoteRow, usePlace } from '../components/note-row.js';
import { useCapture } from '../components/capture.js';

const PAGE = 60;
// Launch city (DECISIONS 11): where the map opens when there is no position and no note.
const DEFAULT_CENTER = { lat: 43.5519, lon: 10.308 };

/** Pins contributed by other features (colleague alerts), refreshed when their data changes. */
function useExtraPins(on) {
  const [pins, setPins] = useState(/** @type {any[]} */ ([]));
  useEffect(() => {
    if (!on) return undefined;
    let alive = true;
    const load = () => slots.collect('map.pins', { now: clock.now() })
      .then((rows) => alive && setPins(rows), (err) => log.error('note', err));
    load();
    const off = events.on('data:changed', (e) => e.store !== 'notes' && load());
    return () => {
      alive = false;
      off();
    };
  }, [on]);
  return pins;
}

/** @param {{query:Record<string,string>}} props */
export default function NoteList({ query }) {
  useLang();
  const mapView = query?.vista === 'mappa';
  const filter = query?.filtro ?? '';
  const now = useTick(60000);
  const { data, loading } = useLive(['notes'], () => notes.listNotes());
  const place = usePlace();
  const [limit, setLimit] = useState(PAGE);
  const [mapReady, setMapReady] = useState(false);
  const map = useRef(/** @type {any} */ (null));
  const capture = useCapture();
  const extra = useExtraPins(mapView);

  useEffect(() => {
    // One reading for the distances, never the first permission prompt of the app.
    if (!geo.lastFix() && settings.get('locationExplained') === true) geo.currentPosition().catch(() => null);
  }, []);
  useEffect(() => {
    setLimit(PAGE);
    if (!mapView) setMapReady(false);
  }, [filter, mapView]);

  const all = data ?? [];
  const rows = useMemo(() => sortNotes(filterNotes(all, filter), place), [data, filter, place]);
  const pins = useMemo(() => {
    const date = new Date(now);
    const mine = filterNotes(all, filter).map((n) => ({
      id: n.id, lat: n.lat, lon: n.lon, tone: category(n.cat).tone, icon: category(n.cat).icon,
      label: noteTitle(n, t), dim: !isScheduleActive(n.schedule, date),
    }));
    return [...mine, ...extra.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, tone: p.tone, icon: p.icon,
      label: p.label, dim: p.dim }))];
  }, [data, filter, extra, now]);

  const go = (q) => router.navigate('/note', { replace: true, query: q });
  const setView = (v) => go({ ...(v === 'mappa' ? { vista: v } : {}), ...(filter ? { filtro: filter } : {}) });
  const setFilter = (f) => go({ ...(mapView ? { vista: 'mappa' } : {}), ...(f ? { filtro: f } : {}) });
  const onPinTap = (id) => {
    if (all.some((n) => n.id === id)) {
      router.navigate(`/note/${id}`);
      return;
    }
    const pin = extra.find((p) => p.id === id);
    const tap = pin?.onTap ?? slots.items('map.pins').find((s) => s.featureId === pin?.featureId)?.onTap;
    if (typeof tap === 'function') tap(id);
    // A pin of another feature without its own handler opens that feature's screen.
    else if (pin?.featureId && router.resolve(router.href(`/${pin.featureId}`)).def?.path === `/${pin.featureId}`) {
      router.navigate(`/${pin.featureId}`);
    }
  };
  const atPoint = (p) => capture.begin({ lat: p.lat, lon: p.lon, acc: null, at: clock.now() });
  const atCenter = () => {
    try {
      atPoint(map.current.getCenter());
    } catch (err) {
      capture.begin();
    }
  };
  const locate = () => {
    const fix = geo.lastFix();
    if (fix && map.current) map.current.flyTo(fix.lat, fix.lon);
    else geo.currentPosition().then((f) => f && map.current?.flyTo(f.lat, f.lon));
  };

  const list = all.length === 0 && !loading
    ? html`<${Empty} icon="map-pin" title=${t('note.list.empty')} text=${t('note.list.emptyText')}
        action=${{ label: t('note.list.demo'), onClick: () => router.navigate('/demo') }} />`
    : html`
      ${!place && rows.length > 1 && html`<p class="t-caption t-muted">${t('note.list.noPosition')}</p>`}
      ${loading && html`<p class="t-body-m t-muted">${t('core.state.loading')}</p>`}
      ${!loading && rows.length === 0 && html`<p class="t-body-m t-muted">${t('note.list.noneFiltered')}</p>`}
      <${List} label=${t('note.title')}>
        ${rows.slice(0, limit).map((r) => html`<${NoteRow} key=${r.note.id} note=${r.note} distM=${r.distM}
          now=${now} />`)}
      <//>
      ${rows.length > limit && html`<${Button} variant="secondary" block label=${t('core.action.showMore')}
        onClick=${() => setLimit(limit + PAGE)} />`}`;

  const center = place ?? (rows[0] ? { lat: rows[0].note.lat, lon: rows[0].note.lon } : DEFAULT_CENTER);
  const sticky = capture.after ? capture.afterBar
    : mapView && mapReady
      ? html`<div class="f-note-mapbar">
          <${Button} variant="secondary" iconOnly icon="locate-fixed" label=${t('note.map.locate')} onClick=${locate} />
          <${Button} block size="xl" icon="crosshair" label=${t('note.map.center')} busy=${capture.busy}
            onClick=${atCenter} />
        </div>`
      : html`<${Button} block size="xl" icon="map-pin-plus" label=${t('note.list.add')} busy=${capture.busy}
          onClick=${() => capture.begin()} />`;

  return html`<${Screen} title=${t('note.title')} sticky=${sticky}>
    <${Chips} label=${t('note.list.view')}>
      <${Chip} icon="list" label=${t('note.list.asList')} pressed=${!mapView} onToggle=${() => setView('elenco')} />
      <${Chip} icon="map" label=${t('note.list.asMap')} pressed=${mapView} onToggle=${() => setView('mappa')} />
    <//>
    <div class="f-note-scroll" role="group" aria-label=${t('note.list.filter')}>
      <${Chip} label=${t('note.filter.all')} pressed=${!filter} onToggle=${() => setFilter('')} />
      <${Chip} label=${t('note.filter.incomplete')} pressed=${filter === FILTER_INCOMPLETE}
        onToggle=${() => setFilter(FILTER_INCOMPLETE)} />
      ${NOTE_CATS.map((id) => html`<${Chip} key=${id} icon=${CATEGORIES[id].icon} label=${t(catLabelKey(id))}
        pressed=${filter === id} onToggle=${() => setFilter(filter === id ? '' : id)} />`)}
    </div>
    ${mapView
      ? html`<${MapView} center=${center} zoom=${15} pins=${pins} user crosshair onPinTap=${onPinTap}
          onLongPress=${atPoint} fallback=${list}
          onReady=${(m) => {
            map.current = m;
            setMapReady(true);
          }} />`
      : list}
    ${capture.node}
  <//>`;
}
