// @ts-check
// Furgone qui: "Il furgone è qui", then distance, the point on the map, the walk back and
// "L'ho ritrovato". The map is an extra: distance and buttons work without it.
import { html, useEffect, useMemo, useRef, useState } from '../../../ui/html.js';
import { useLive, useLang, useFix, useTick, useSetting, useAction } from '../../../ui/hooks.js';
import {
  Screen, Card, Button, LinkButton, Empty, List, ListRow, MapView, toast,
} from '../../../ui/kit/index.js';
import { t, geo, format, handoff, log } from '../../../core/api.js';
import { round } from '../../../core/pure/geo-math.js';
import { loadSpot, saveHere, clearSpot, restoreSpot } from '../logic/data.js';
import { distanceM, walkMin, viewFor, walkApp, HERE_M } from '../logic/spot.js';

/** The distance is shown only from a position this recent. */
const FRESH_FIX_MS = 60000;
const IMPRECISE_M = 50;

/**
 * The courier's position while the screen is open. During a shift with the phone in the holder the
 * watch already runs; elsewhere this asks for one reading every few seconds.
 * @param {boolean} active @returns {{here:import('../../../core/types.js').Fix|null, tried:boolean}}
 */
function useHere(active) {
  const now = useTick(5000);
  const fix = useFix();
  const asking = useRef(false);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!active || geo.isRunning() || asking.current) return;
    const last = geo.lastFix();
    if (last && now - last.ts < 8000) return;
    asking.current = true;
    geo.currentPosition({ maxAgeMs: 5000, timeoutMs: 8000 }).then(() => {
      asking.current = false;
      setTried(true);
    });
  }, [active, now]);
  return { here: fix && now - fix.ts <= FRESH_FIX_MS ? fix : null, tried };
}

const undo = (prev) => () => {
  restoreSpot(prev).catch((err) => log.error('furgone-qui', err));
};

export default function SpotScreen() {
  const lang = useLang();
  const { data: spot } = useLive(['vanSpot'], loadSpot);
  const [navApp] = useSetting('nav.app');
  const { here, tried } = useHere(Boolean(spot));
  const map = useRef(/** @type {import('../../../ui/map/map.js').MapHandle|null} */ (null));
  const [ready, setReady] = useState(false);
  const framedFor = useRef(0);

  // The position is asked inside the tap. "Annulla" puts back what was there before.
  const save = useAction(async () => {
    const prev = spot ?? null;
    const saved = await saveHere();
    toast(t('furgone-qui.saved', { time: format.time(saved.at) }), { icon: 'check',
      action: { label: t('core.action.undo'), onClick: undo(prev) } });
  });
  const found = useAction(async () => {
    const prev = spot ?? null;
    await clearSpot();
    toast(t('furgone-qui.cleared'), { icon: 'check', action: { label: t('core.action.undo'), onClick: undo(prev) } });
  });

  const at = spot?.at ?? 0;
  const pins = useMemo(() => (spot ? [{ id: 'van', lat: spot.lat, lon: spot.lon, tone: 'info', icon: 'truck',
    label: t('furgone-qui.pin'), big: true }] : []), [at, lang]);
  // The map opens on the van; once, when the first position comes, it widens to show both.
  const first = useMemo(() => (spot ? viewFor(spot, null) : null), [at]);
  useEffect(() => {
    if (!spot || !here || !ready || !map.current || framedFor.current === spot.at) return;
    framedFor.current = spot.at;
    const v = viewFor(spot, here);
    map.current.flyTo(v.lat, v.lon, v.zoom);
  }, [at, here?.ts, ready]);
  // A dashed line from the courier to the van; rounded so it is not redrawn at every fix.
  const hereLat = here ? round(here.lat, 4) : null;
  const hereLon = here ? round(here.lon, 4) : null;
  const line = useMemo(() => (spot && hereLat !== null && hereLon !== null
    ? [[hereLat, hereLon], [spot.lat, spot.lon]] : null), [at, hereLat, hereLon]);

  if (spot === undefined) {
    return html`<${Screen} title=${t('furgone-qui.title')} back="/altro">
      <p class="t-body-m t-muted" role="status">${t('core.state.loading')}</p>
    <//>`;
  }
  if (!spot || !first) {
    const sticky = html`<${Button} variant="primary" size="xl" block icon="circle-parking" busy=${save.busy}
      label=${t(save.busy ? 'furgone-qui.saving' : 'furgone-qui.here')} onClick=${save.run} />`;
    return html`<${Screen} title=${t('furgone-qui.title')} back="/altro" sticky=${sticky}>
      <${Empty} icon="circle-parking" title=${t('furgone-qui.empty.title')} text=${t('furgone-qui.empty.text')} />
      <p class="t-caption t-muted t-center">${t('furgone-qui.privacy')}</p>
    <//>`;
  }

  const d = distanceM(spot, here);
  const near = d !== null && d <= HERE_M;
  const meta = [
    d !== null && !near && t('furgone-qui.walk', { n: walkMin(d) }),
    t('furgone-qui.savedAt', { time: format.time(spot.at) }),
    spot.acc !== null && format.accuracy(spot.acc),
  ].filter(Boolean).join(' · ');
  const app = walkApp(navApp, handoff.navApps());
  const sticky = html`
    <${LinkButton} external variant="primary" size="xl" block icon="navigation" label=${t('furgone-qui.walkTo')}
      href=${handoff.navUrl(app, spot.lat, spot.lon, { walk: true })} />
    <${Button} variant="secondary" block icon="check" label=${t('furgone-qui.found')} busy=${found.busy}
      onClick=${found.run} />`;
  const fallback = html`<${List}>
    <${ListRow} icon="circle-parking" title=${t('furgone-qui.pin')} sub=${format.coords(spot.lat, spot.lon)}
      value=${d === null ? undefined : format.distance(d)} />
  <//>`;

  return html`<${Screen} title=${t('furgone-qui.title')} back="/altro" sticky=${sticky}>
    <div class="stack">
      <${Card} icon="circle-parking" title=${t('furgone-qui.pin')}
        stat=${d !== null && !near ? { label: t('furgone-qui.dist'), value: format.distance(d) } : undefined}>
        ${near && html`<p class="t-title-m f-furgone-qui-meta">${t('furgone-qui.atHere')}</p>`}
        ${d === null && html`<p class="t-body-m f-furgone-qui-meta" role="status">
          ${t(tried ? 'furgone-qui.noPosition' : 'furgone-qui.locating')}</p>`}
        <p class="t-body-m t-muted f-furgone-qui-meta">${meta}</p>
      <//>
      ${spot.acc !== null && spot.acc > IMPRECISE_M && html`<p class="t-caption t-muted">
        ${t('furgone-qui.imprecise', { acc: format.accuracy(spot.acc) })}</p>`}
      <div class="f-furgone-qui-map">
        <${MapView} center=${{ lat: first.lat, lon: first.lon }} zoom=${first.zoom} pins=${pins} user follow=${false}
          cluster=${false} line=${line} fallback=${fallback}
          onReady=${(m) => {
            map.current = m;
            setReady(true);
          }} />
      </div>
      <div class="f-furgone-qui-foot">
        <${Button} variant="ghost" icon="refresh-cw" busy=${save.busy}
          label=${t(save.busy ? 'furgone-qui.saving' : 'furgone-qui.move')} onClick=${save.run} />
        <p class="t-caption t-muted">${t('furgone-qui.privacy')}</p>
      </div>
    </div>
  <//>`;
}
