// @ts-check
// Adding stops, only with the vehicle stopped. Many at once: a scanned label or list (the keyboard's
// own text scanner, or dictation), a pasted list, the usual addresses. One at a time: address search,
// "Aggiungi qui", a saved note. A stop is an address or a point with an optional short label: never a
// name or a parcel.
import { html, useState, useCallback, useEffect, useRef } from '../../../ui/html.js';
import { t, tn, router, format } from '../../../core/api.js';
import { useLive, useLang, useStore, useAction } from '../../../ui/hooks.js';
import { Screen, Button, Chip, Sheet, Field, Banner, toast } from '../../../ui/kit/index.js';
import { pendingStops } from '../logic/route.js';
import { loadRoute, addStops, positionNow } from '../logic/data.js';
import { useHere } from '../parts/common.js';
import { SearchPane } from '../parts/search-pane.js';
import { IntakePane } from '../parts/intake-pane.js';
import { UsualPane } from '../parts/usual-pane.js';
import { NotesPane } from '../parts/notes-pane.js';
import { PhotonSheet } from '../parts/photon-sheet.js';

/** The first one opens when the address names no mode. The two that add many stops at once come
 *  first: on a small phone the row shows them without scrolling. */
const MODES = /** @type {const} */ (['scansiona', 'abituali', 'cerca', 'incolla', 'note']);
const MODE_VIEW = {
  scansiona: { icon: 'camera', key: 'giro.mode.scan' },
  abituali: { icon: 'star', key: 'giro.mode.usual' },
  cerca: { icon: 'search', key: 'giro.mode.search' },
  incolla: { icon: 'clipboard-list', key: 'giro.mode.paste' },
  note: { icon: 'map-pin', key: 'giro.mode.notes' },
};
const LABEL_MAX = 30;
/** Above this accuracy "Aggiungi qui" says the point is rough. */
const ROUGH_ACC_M = 50;

/** "Aggiungi qui": the point is taken, the short label is optional. */
function HereSheet({ fix, busy, onAdd, onClose }) {
  const [label, setLabel] = useState('');
  const footer = html`<${Button} block size="xl" icon="plus" label=${t('giro.here.add')} busy=${busy}
    onClick=${() => onAdd({ lat: fix.lat, lon: fix.lon, label, src: 'here', addr: null })} />`;
  const rough = fix.acc > ROUGH_ACC_M;
  return html`<${Sheet} open title=${t('giro.here')} onClose=${onClose} footer=${footer}>
    <p class="t-body-m" role="status">
      ${t(rough ? 'giro.here.rough' : 'giro.here.acc', { acc: format.accuracy(fix.acc) })}
    </p>
    <${Field} label=${t('giro.here.label')} value=${label} onInput=${setLabel} max=${LABEL_MAX}
      placeholder=${t('giro.here.placeholder')} helper=${t('giro.here.help')} />
  <//>`;
}

/** @param {{query?:Record<string,string>}} props */
export default function AddStopsScreen({ query }) {
  useLang();
  const mode = MODES.find((m) => m === query?.modo) ?? MODES[0];
  const moving = useStore((s) => s.moving && !s.passenger);
  const { data: route } = useLive(['route'], loadRoute);
  const here = useHere();
  const [hereFix, setHereFix] = useState(/** @type {any} */ (null));
  const [askOnline, setAskOnline] = useState(false);
  // What the open mode has ready: rows read from a scan (the bottom bar steps back), or usual
  // addresses ticked (the bottom bar adds them).
  const [pending, setPending] = useState(0);
  const [usual, setUsual] = useState(/** @type {{count:number, run:()=>void, busy:boolean}|null} */ (null));
  const ask = useCallback(() => setAskOnline(true), []);
  // The row of modes scrolls sideways on a small phone: the open one is always in view.
  const modes = useRef(/** @type {HTMLElement|null} */ (null));
  useEffect(() => {
    /** @type {any} */ (modes.current)?.querySelector?.('[aria-pressed="true"]')
      ?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [mode]);

  const add = useAction(async (input) => {
    const res = await addStops([input]);
    if (res.added) toast(t('giro.added', { label: input.label || t('giro.stop.point') }), { icon: 'check' });
    else toast(t(res.full ? 'giro.full' : 'giro.repeated'), { icon: 'info' });
  });
  const locate = useAction(async () => {
    const fix = await positionNow();
    if (fix) setHereFix(fix);
    else toast(t('giro.here.noFix'), { icon: 'triangle-alert' });
  });
  const addHere = (input) => {
    add.run(input);
    setHereFix(null);
  };

  const count = route ? pendingStops(route).length : 0;
  const setMode = (m) => router.navigate('/giro/aggiungi', { replace: true, query: m === MODES[0] ? {} : { modo: m } });
  const seeRoute = html`<${Button} block size="xl" icon="route" variant=${pending ? 'secondary' : 'primary'}
    onClick=${() => router.back('/giro')} label=${count ? tn('giro.seeRoute', count) : t('giro.seeRoute.empty')} />`;
  const sticky = usual
    ? html`<${Button} block size="xl" icon="plus" label=${tn('giro.rows.add', usual.count)} busy=${usual.busy}
        disabled=${moving} onClick=${usual.run} />`
    : seeRoute;

  return html`<${Screen} title=${t('giro.add.title')} back="/giro" sticky=${sticky}>
    ${moving && html`<${Banner} tone="warning" icon="triangle-alert" text=${t('giro.add.moving')} />`}
    <${Button} block variant="secondary" icon="locate-fixed" label=${t('giro.here')} busy=${locate.busy}
      disabled=${moving} onClick=${locate.run} />
    <div class="f-giro-modes" role="group" aria-label=${t('giro.mode')} ref=${modes}>
      ${MODES.map((m) => html`<${Chip} key=${m} icon=${MODE_VIEW[m].icon} label=${t(MODE_VIEW[m].key)}
        pressed=${m === mode} onToggle=${() => setMode(m)} />`)}
    </div>
    ${mode === 'scansiona' && html`<${IntakePane} key="scan" variant="scan" moving=${moving} onAskOnline=${ask}
      onPending=${setPending} />`}
    ${mode === 'abituali' && html`<${UsualPane} route=${route} onAction=${setUsual} />`}
    ${mode === 'cerca' && html`<${SearchPane} onAdd=${add.run} busy=${add.busy} onAskOnline=${ask} />`}
    ${mode === 'incolla' && html`<${IntakePane} key="paste" variant="paste" moving=${moving} onAskOnline=${ask}
      onPending=${setPending} />`}
    ${mode === 'note' && html`<${NotesPane} route=${route} here=${here} onAdd=${add.run} busy=${add.busy} />`}
    ${hereFix && html`<${HereSheet} fix=${hereFix} busy=${add.busy} onAdd=${addHere}
      onClose=${() => setHereFix(null)} />`}
    <${PhotonSheet} open=${askOnline} onClose=${() => setAskOnline(false)} />
  <//>`;
}
