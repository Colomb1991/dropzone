// @ts-check
// Adding stops, only with the vehicle stopped: address search, a pasted list, "Aggiungi qui", a
// saved note. A stop is an address or a point with an optional short label: never a name or a parcel.
import { html, useState } from '../../../ui/html.js';
import { t, tn, router, format } from '../../../core/api.js';
import { useLive, useLang, useStore, useAction } from '../../../ui/hooks.js';
import { Screen, Button, Chip, Sheet, Field, Banner, toast } from '../../../ui/kit/index.js';
import { pendingStops } from '../logic/route.js';
import { loadRoute, addStops, positionNow } from '../logic/data.js';
import { useHere } from '../parts/common.js';
import { SearchPane } from '../parts/search-pane.js';
import { PastePane } from '../parts/paste-pane.js';
import { NotesPane } from '../parts/notes-pane.js';
import { PhotonSheet } from '../parts/photon-sheet.js';

const MODES = /** @type {const} */ (['cerca', 'incolla', 'note']);
const MODE_VIEW = {
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
  const mode = MODES.find((m) => m === query?.modo) ?? 'cerca';
  const moving = useStore((s) => s.moving && !s.passenger);
  const { data: route } = useLive(['route'], loadRoute);
  const here = useHere();
  const [hereFix, setHereFix] = useState(/** @type {any} */ (null));
  const [askOnline, setAskOnline] = useState(false);

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
  const setMode = (m) => router.navigate('/giro/aggiungi', { replace: true, query: m === 'cerca' ? {} : { modo: m } });
  const sticky = html`<${Button} block size="xl" icon="route" onClick=${() => router.back('/giro')}
    label=${count ? tn('giro.seeRoute', count) : t('giro.seeRoute.empty')} />`;

  return html`<${Screen} title=${t('giro.add.title')} back="/giro" sticky=${sticky}>
    ${moving && html`<${Banner} tone="warning" icon="triangle-alert" text=${t('giro.add.moving')} />`}
    <${Button} block variant="secondary" icon="locate-fixed" label=${t('giro.here')} busy=${locate.busy}
      disabled=${moving} onClick=${locate.run} />
    <div class="f-giro-modes" role="group" aria-label=${t('giro.mode')}>
      ${MODES.map((m) => html`<${Chip} key=${m} icon=${MODE_VIEW[m].icon} label=${t(MODE_VIEW[m].key)}
        pressed=${m === mode} onToggle=${() => setMode(m)} />`)}
    </div>
    ${mode === 'cerca' && html`<${SearchPane} onAdd=${add.run} busy=${add.busy}
      onAskOnline=${() => setAskOnline(true)} />`}
    ${mode === 'incolla' && html`<${PastePane} moving=${moving} onAskOnline=${() => setAskOnline(true)} />`}
    ${mode === 'note' && html`<${NotesPane} route=${route} here=${here} onAdd=${add.run} busy=${add.busy} />`}
    ${hereFix && html`<${HereSheet} fix=${hereFix} busy=${add.busy} onAdd=${addHere}
      onClose=${() => setHereFix(null)} />`}
    <${PhotonSheet} open=${askOnline} onClose=${() => setAskOnline(false)} />
  <//>`;
}
