// @ts-check
// The route on the map: numbered pins, the next stop larger, done stops dimmed. The list stays
// under it, so when the map cannot start the notice already points at the fallback.
import { html, useRef, useState, useMemo } from '../../../ui/html.js';
import { t, geo } from '../../../core/api.js';
import { MapView, Button } from '../../../ui/kit/index.js';
import { round } from '../../../core/pure/geo-math.js';
import { nextStop, pendingStops, viewFor } from '../logic/route.js';
import { stopLabel } from './common.js';

// Launch city (DECISIONS 11): only used when there is neither a stop nor a position.
const DEFAULT_VIEW = { lat: 43.5519, lon: 10.308, zoom: 13 };
const NEAR_ZOOM = 16;

/**
 * @param {import('../logic/route.js').Route} route
 * @returns {import('../../../ui/map/map.js').MapPin[]} in drawing order: the next stop last, on top
 */
export function routePins(route) {
  const next = nextStop(route);
  const pins = route.stops.map((s, i) => ({
    id: s.id, lat: s.lat, lon: s.lon, icon: 'map-pin', num: i + 1, label: stopLabel(s),
    tone: s.done ? 'neutral' : (s.id === next?.id ? 'success' : 'info'), dim: s.done, big: s.id === next?.id,
  }));
  return [...pins.filter((p) => p.dim), ...pins.filter((p) => !p.dim && !p.big).reverse(), ...pins.filter((p) => p.big)];
}

/** What is left of the route (all of it when it is finished), with the courier when known. */
function overview(route, here) {
  const pending = pendingStops(route);
  const points = pending.length ? pending : route.stops;
  return viewFor(here ? [...points, here] : points) ?? DEFAULT_VIEW;
}

/**
 * @param {{route:import('../logic/route.js').Route, here:{lat:number, lon:number}|null,
 *   onPinTap:(id:string)=>void}} props
 */
export function RouteMap({ route, here, onPinTap }) {
  const map = useRef(/** @type {import('../../../ui/map/map.js').MapHandle|null} */ (null));
  const [ready, setReady] = useState(false);
  const next = nextStop(route);
  const pins = useMemo(() => routePins(route), [route]);
  // The map opens on the whole route; MapView reads centre and zoom only when it starts.
  const first = useMemo(() => overview(route, here), []);
  // A dashed line from the courier to the next stop; rounded so it is not redrawn at every fix.
  const hereLat = here ? round(here.lat, 4) : null;
  const hereLon = here ? round(here.lon, 4) : null;
  const line = useMemo(() => (hereLat !== null && hereLon !== null && next
    ? [[hereLat, hereLon], [next.lat, next.lon]] : null), [hereLat, hereLon, next?.id]);

  const showAll = () => {
    const v = overview(route, here);
    map.current?.flyTo(v.lat, v.lon, v.zoom);
  };
  const showMe = () => {
    if (here) map.current?.flyTo(here.lat, here.lon, NEAR_ZOOM);
    else geo.currentPosition({ maxAgeMs: 10000 }).then((f) => f && map.current?.flyTo(f.lat, f.lon, NEAR_ZOOM));
  };

  return html`<div class="stack f-giro-map">
    <${MapView} center=${{ lat: first.lat, lon: first.lon }} zoom=${first.zoom} pins=${pins} user follow=${false}
      cluster=${false} line=${line} onPinTap=${onPinTap} fallback=${null}
      onReady=${(m) => {
        map.current = m;
        setReady(true);
      }} />
    ${ready && html`<div class="f-giro-mapbar">
      <${Button} variant="secondary" icon="route" label=${t('giro.map.all')} onClick=${showAll} />
      <${Button} variant="secondary" icon="crosshair" label=${t('giro.map.next')} disabled=${!next}
        onClick=${() => next && map.current?.flyTo(next.lat, next.lon, NEAR_ZOOM)} />
      <${Button} variant="secondary" iconOnly icon="locate-fixed" label=${t('giro.map.me')} onClick=${showMe} />
    </div>`}
  </div>`;
}
