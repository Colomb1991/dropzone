// @ts-check
import { html, useEffect, useState } from '../../../ui/html.js';
import { useStore, useLang, useTick, useLive, useAction } from '../../../ui/hooks.js';
import { Screen, Button, Sheet, Tile, Tiles, SlotOutlet } from '../../../ui/kit/index.js';
import { t, session, settings, slots, router, log } from '../../../core/api.js';
import { greeting } from '../logic/shift-math.js';
import * as state from '../state.js';
import ShiftHome from './shift.js';
import { EndCard } from './end.js';

/** Legal notice 2: shown before the system location prompt until the courier taps "Continua". */
function LocationSheet({ onStart, onClose }) {
  const footer = html`<div class="stack">
    <${Button} block size="xl" label=${t('core.action.continue')} onClick=${() => onStart({})} />
    <${Button} block variant="ghost" label=${t('turno.loc.notNow')} onClick=${() => onStart({ location: false })} />
  </div>`;
  return html`<${Sheet} open title=${t('turno.loc.title')} onClose=${onClose} footer=${footer}>
    <p class="t-body-m">${t('turno.loc.text')}</p>
  <//>`;
}

function IdleHome() {
  const now = useTick(60000);
  const [askLocation, setAskLocation] = useState(false);
  const tiles = useLive(['notes', 'route'], () => slots.collect('home.tiles', {}), []);
  // session.startShift runs inside the tap: it unlocks sound and asks for the position there.
  const start = useAction((opts) => session.startShift(opts));
  const onStart = () => {
    if (settings.get('locationExplained')) start.run({});
    else setAskLocation(true);
  };
  const fromSheet = (opts) => {
    start.run(opts);
    setAskLocation(false);
    if (opts.location !== false) settings.set('locationExplained', true).catch((err) => log.error('turno', err));
  };
  const shown = (tiles.data ?? []).filter((x) => {
    try {
      return typeof x.visible === 'function' ? x.visible() !== false : true;
    } catch (err) {
      return false;
    }
  });
  const sticky = html`<${Button} variant="primary" size="xl" block icon="play" label=${t('turno.start')}
    busy=${start.busy} onClick=${onStart} />`;
  return html`<${Screen} title=${t('core.app.name')} sticky=${sticky}>
    <div class="stack">
      <p class="t-title-m">${t(`turno.greet.${greeting(now)}`)}</p>
      <${SlotOutlet} name="home.idle" />
      ${shown.length > 0 && html`<${Tiles}>
        ${shown.map((x) => html`<${Tile} icon=${x.icon} label=${t(x.labelKey)} value=${x.value} href=${router.href(x.to)} />`)}
      <//>`}
      <p class="t-caption t-muted">${t('turno.idle.caption')}</p>
    </div>
    ${askLocation && html`<${LocationSheet} onStart=${fromSheet} onClose=${() => setAskLocation(false)} />`}
  <//>`;
}

/** Route "/": idle home, shift home, or the end card of the shift that just closed. */
export default function Home() {
  useLang();
  const shift = useStore((s) => s.shift);
  const [ended, setEnded] = useState(() => state.endedShift());
  useEffect(() => {
    setEnded(state.endedShift());
    return state.onChange(() => setEnded(state.endedShift()));
  }, []);
  if (shift) return html`<${ShiftHome} shift=${shift} />`;
  if (ended) return html`<${EndCard} shift=${ended} onDone=${state.clearEnded} />`;
  return html`<${IdleHome} />`;
}
