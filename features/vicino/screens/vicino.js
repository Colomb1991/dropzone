// @ts-check
// Vicino a me: chips, a list by distance, "Vai". List only in Release 1.
import { html, useState, useEffect, useRef } from '../../../ui/html.js';
import { useLive, useSetting, useFix, useLang, useStore } from '../../../ui/hooks.js';
import {
  Screen, Chips, Chip, List, ListRow, Button, LinkButton, Banner, Empty, NavigateSheet,
} from '../../../ui/kit/index.js';
import { t, tn, clock, geo, notes, format, handoff, router, log } from '../../../core/api.js';
import { CHIPS, CHIP_ICONS, itemsForChip, ownSpots, hoursLabel, ageDays } from '../logic/poi.js';
import { loadAround } from '../logic/cells.js';

const RELOAD_M = 500;
const OSM_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su', 'PH', 'off'];
const hoursWords = () => ({
  always: t('vicino.hours.always'),
  days: Object.fromEntries(OSM_DAYS.map((d) => [d, t(`vicino.hours.${d}`)])),
});

function GoButton({ dest, navApp, onAsk }) {
  // With a remembered navigator the row is a real link: one tap, no picker.
  if (navApp && navApp !== 'ask' && handoff.navApps().includes(navApp)) {
    return html`<${LinkButton} external variant="secondary" icon="navigation" label=${t('core.action.go')}
      href=${handoff.navUrl(navApp, dest.lat, dest.lon)} />`;
  }
  return html`<${Button} variant="secondary" icon="navigation" label=${t('core.action.go')} onClick=${() => onAsk(dest)} />`;
}

export default function VicinoScreen() {
  useLang();
  const online = useStore((s) => s.online);
  const [lastChip, setLastChip] = useSetting('vicino.lastChip');
  const [serviceOn] = useSetting('svc.overpass');
  const [navApp] = useSetting('nav.app');
  const chip = CHIPS.includes(lastChip) ? lastChip : 'bagni';
  const liveFix = useFix();
  const [here, setHere] = useState(/** @type {{lat:number, lon:number}|null} */ (() => geo.lastFix()));
  const [locating, setLocating] = useState(false);
  const [cells, setCells] = useState(/** @type {Record<string, any>} */ ({}));
  const [status, setStatus] = useState(/** @type {'idle'|'loading'|'done'} */ ('idle'));
  const [outcome, setOutcome] = useState(/** @type {any} */ (null));
  const [dest, setDest] = useState(/** @type {any} */ (null));
  const loadedAt = useRef(/** @type {{lat:number, lon:number, key:number}|null} */ (null));
  const seq = useRef(0);
  const [reloadKey, setReloadKey] = useState(0);
  const { data: allNotes } = useLive(['notes'], () => notes.listNotes({ cat: 'bagno' }), []);

  const locate = () => {
    setLocating(true);
    geo.currentPosition().then((fix) => {
      setLocating(false);
      if (fix) setHere({ lat: fix.lat, lon: fix.lon });
    });
  };
  useEffect(() => {
    if (!here) locate();
  }, []);
  useEffect(() => {
    if (liveFix) setHere({ lat: liveFix.lat, lon: liveFix.lon });
  }, [liveFix]);

  // Cells load again only after the user has moved, or when the service or the network comes back.
  const lat = here?.lat ?? null;
  const lon = here?.lon ?? null;
  useEffect(() => {
    if (lat === null || lon === null) return;
    const prev = loadedAt.current;
    if (prev && prev.key === reloadKey && Math.hypot(prev.lat - lat, prev.lon - lon) * 111195 <= RELOAD_M) return;
    loadedAt.current = { lat, lon, key: reloadKey };
    // A newer load wins; small position changes must not cancel the one in flight.
    const mine = ++seq.current;
    const current = () => mine === seq.current;
    setStatus('loading');
    loadAround({ lat, lon }, (rec) => current() && setCells((c) => ({ ...c, [rec.cellId]: rec }))).then((r) => {
      if (!current()) return;
      setOutcome(r);
      setStatus('done');
    }, (err) => {
      log.error('vicino', err);
      if (current()) setStatus('done');
    });
  }, [lat, lon, reloadKey]);
  useEffect(() => () => {
    seq.current = -1;
  }, []);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) firstRun.current = false;
    else setReloadKey((k) => k + 1);
  }, [serviceOn, online]);

  const records = Object.values(cells);
  const items = records.flatMap((r) => r.items);
  const mine = ownSpots(allNotes ?? [], here);
  const places = here && chip !== 'miei' ? itemsForChip(chip, items, here) : [];
  const showMine = chip === 'miei' || chip === 'bagni';
  const oldest = records.length ? Math.min(...records.map((r) => r.fetchedAt)) : null;
  const days = oldest === null ? 0 : ageDays(oldest, clock.now());
  const words = hoursWords();
  const none = status === 'done' && places.length === 0 && (!showMine || mine.length === 0);

  let notice = null;
  if (chip !== 'miei' && status === 'done' && outcome) {
    const reason = outcome.service.reason;
    if (reason === 'user-off' && outcome.missing > 0) {
      notice = html`<${Banner} tone="neutral" icon="info" text=${t('vicino.off')}
        action=${{ label: t('core.action.openSettings'), onClick: () => router.navigate('/impostazioni') }} />`;
    } else if (reason === 'offline') {
      notice = html`<${Banner} tone="neutral" icon="wifi-off"
        text=${records.length ? tn('vicino.offlineAge', days) : t('vicino.offlineEmpty')} />`;
    } else if (outcome.failed > 0 && outcome.missing > 0) {
      notice = html`<${Banner} tone="warning" icon="triangle-alert" text=${t('vicino.error')}
        action=${{ label: t('core.action.retry'), onClick: () => setReloadKey((k) => k + 1) }} />`;
    }
  }
  const placeTags = (p) => [
    p.likely && { label: t('vicino.tag.likely') },
    p.fee && { label: t('vicino.tag.fee'), tone: 'warning' },
    p.customers && { label: t('vicino.tag.customers') },
  ].filter(Boolean);

  return html`<${Screen} title=${t('vicino.title')}>
    <div class="stack">
      <${Chips} label=${t('vicino.title')}>
        ${CHIPS.map((c) => html`<${Chip} label=${t(`vicino.chip.${c}`)} icon=${CHIP_ICONS[c]} pressed=${c === chip}
          onToggle=${() => setLastChip(c).catch((err) => log.error('vicino', err))} />`)}
      <//>
      ${!here && html`<${Empty} icon="locate-fixed" title=${t(locating ? 'vicino.locating' : 'vicino.noPosition')}
        action=${locating ? undefined : { label: t('core.action.retry'), onClick: locate }} />`}
      ${notice}
      ${here && chip !== 'miei' && status === 'loading' && places.length === 0
        && html`<p class="t-body-m t-muted" role="status">${t('vicino.searching')}</p>`}
      ${here && !notice && days >= 1 && places.length > 0
        && html`<p class="t-caption t-muted">${tn('vicino.age', days)}</p>`}
      ${showMine && mine.length > 0 && html`<${List} label=${t('vicino.chip.miei')}>
        ${mine.map(({ note, distM }) => html`<${ListRow} key=${note.id} icon="star" tone="success"
          title=${note.text || t('vicino.mine.untitled')} sub=${distM === null ? undefined : format.distance(distM)}
          tags=${[{ label: t('vicino.tag.mine'), tone: 'success' }]}
          trailing=${html`<${GoButton} dest=${{ lat: note.lat, lon: note.lon, label: note.text }} navApp=${navApp}
            onAsk=${setDest} />`} />`)}
      <//>`}
      ${chip === 'miei' && mine.length === 0 && html`<${Empty} icon="star" title=${t('vicino.mine.empty')}
        text=${t('vicino.mine.hint')} />`}
      ${places.length > 0 && html`<${List} label=${t(`vicino.chip.${chip}`)}>
        ${places.map((p) => html`<${ListRow} key=${p.id} icon=${CHIP_ICONS[chip]}
          title=${p.name || t(`vicino.kind.${p.kind}`)}
          sub=${[format.distance(p.distM), hoursLabel(p.hours, words)].filter(Boolean).join(' · ')}
          tags=${placeTags(p)}
          trailing=${html`<${GoButton} dest=${{ lat: p.lat, lon: p.lon, label: p.name || t(`vicino.kind.${p.kind}`) }}
            navApp=${navApp} onAsk=${setDest} />`} />`)}
      <//>`}
      ${here && chip !== 'miei' && none && !notice && html`<${Empty} icon="locate-fixed" title=${t('vicino.none')} />`}
      ${chip !== 'miei' && html`<p class="t-caption t-muted">${t('vicino.credit')} ${t('vicino.legal.accuracy')}</p>`}
    </div>
    <${NavigateSheet} open=${Boolean(dest)} dest=${dest} onClose=${() => setDest(null)} />
  <//>`;
}
