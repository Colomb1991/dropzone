// @ts-check
// "Guarda come funziona" (SPEC 4.13): 45 seconds, three beats. The start tap unlocks sound; every
// spoken line is also a caption; "Esci" reloads the page.
import { html, useEffect, useRef, useState } from '../../../ui/html.js';
import {
  Screen, Button, Art, Icon, Banner, Card, Chip, List, ListRow, toast,
} from '../../../ui/kit/index.js';
import { useStore, useLang, useAction } from '../../../ui/hooks.js';
import { t, clock, format, events, tick, log } from '../../../core/api.js';
import { NOTE_CATS, category, catLabelKey } from '../../../core/pure/catalog.js';
import { TIMES, phaseAt, beatOf } from '../logic/script.js';
import { startDemo, replayDemo, saveDog, exitDemo, demoActive } from '../logic/run.js';

function DemoBanner() {
  return html`<${Banner} tone="access" icon="flask-conical" text=${t('core.banner.demo')}
    action=${{ label: t('core.action.exit'), onClick: exitDemo }} />`;
}

function Progress({ elapsed, beat }) {
  const n = Math.min(TIMES.total, elapsed);
  return html`<div class="f-demo-top">
    <div class="f-demo-progress" role="progressbar" aria-valuemin="0" aria-valuemax=${TIMES.total}
      aria-valuenow=${n} aria-label=${t('demo.progress', { n, total: TIMES.total })}>
      <span style=${{ transform: `scaleX(${n / TIMES.total})` }}></span>
    </div>
    <ol class="f-demo-beats">
      ${[1, 2, 3].map((b) => html`<li data-on=${String(b === beat)} aria-current=${b === beat ? 'step' : null}>
        <span class="num">${b}</span>${t(`demo.beat.${b}`)}
      </li>`)}
    </ol>
  </div>`;
}

function Place({ icon, text }) {
  return html`<p class="f-demo-place"><${Icon} name=${icon} /><span>${text}</span></p>`;
}

function Said({ text }) {
  return html`<p class="f-demo-said" role="status"><${Icon} name="volume-2" /><span>${t('demo.said', { text })}</span></p>`;
}

/**
 * The stage. `initial` places it anywhere on the timeline (a fresh run starts at zero).
 * @param {{initial?:{elapsed?:number, savedAt?:number|null, stoppedS?:number|null, fired?:boolean},
 *   onReplay:()=>void}} props
 */
export function Player({ initial = {}, onReplay }) {
  const [elapsed, setElapsed] = useState(initial.elapsed ?? 0);
  const [savedAt, setSavedAt] = useState(/** @type {number|null} */ (initial.savedAt ?? null));
  const [picking, setPicking] = useState(false);
  const [stoppedS, setStoppedS] = useState(/** @type {number|null} */ (initial.stoppedS ?? null));
  const [fired, setFired] = useState(initial.fired === true);
  const seconds = useRef(elapsed);
  seconds.current = elapsed;

  useEffect(() => {
    const offs = [
      // The same 1 Hz beat moves the simulated van, so the stage and the track never drift apart.
      tick.onTick(() => setElapsed((n) => n + 1), 1000),
      events.on('prox:fired', (e) => {
        if (e.target?.source === 'demo') setFired(true);
      }),
      events.on('driving:changed', (e) => {
        if (e.label === 'stopped' && seconds.current >= TIMES.drive) setStoppedS((cur) => cur ?? seconds.current);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const save = () => {
    setPicking(false);
    setSavedAt((cur) => cur ?? clock.now());
    saveDog().then((fresh) => fresh && toast(t('demo.saved'), { icon: 'check' }), (err) => log.error('demo', err));
  };
  useEffect(() => {
    // Nobody tapped: after 10 s the demo saves the note itself.
    if (savedAt === null && elapsed >= TIMES.autoSave) save();
  }, [elapsed, savedAt]);

  const again = useAction(async () => {
    await replayDemo();
    onReplay();
  });

  const phase = phaseAt({ elapsedS: elapsed, stoppedS });
  const saved = savedAt !== null;
  const dogRow = html`<${List}><${ListRow} icon="dog" tone="danger"
    title=${t('demo.here.row', { time: format.time(savedAt ?? clock.now()) })} value=${format.distance(0)} /><//>`;

  const stage = {
    save: () => html`
      <${Place} icon="map-pin" text=${t('demo.place.gate')} />
      ${!saved && !picking && html`
        <p class="f-demo-hint">${t('demo.hint.save')}</p>
        <${Button} block size="xl" icon="map-pin-plus" label=${t('demo.noteHere')} onClick=${() => setPicking(true)} />`}
      ${!saved && picking && html`
        <p class="f-demo-hint">${t('demo.what')}</p>
        <div class="field">
          <span class="field__label">${t('demo.field')}</span>
          <p class="field__control f-demo-text">${t('demo.text')}</p>
        </div>
        <div class="f-demo-kinds" role="group" aria-label=${t('demo.kind')}>
          ${NOTE_CATS.map((id) => html`<${Chip} key=${id} icon=${category(id).icon} label=${t(catLabelKey(id))}
            pressed=${id === 'cane'} disabled=${id !== 'cane'} />`)}
        </div>
        <${Button} block size="xl" icon="check" label=${t('demo.save')} onClick=${save} />`}
      ${saved && html`
        <p class="f-demo-ok"><${Icon} name="check" size=${32} /><span>${t('demo.saved')}</span></p>
        ${dogRow}
        <p class="t-body-m t-muted">${t('demo.savedNext')}</p>`}
      ${elapsed < 4 && html`<${Said} text=${t('core.say.shiftStart')} />`}`,
    drive: () => html`
      <${Place} icon="car" text=${t('demo.place.drive')} />
      <p class="f-demo-hint">${t(elapsed >= TIMES.arrive ? 'demo.drive.back' : 'demo.drive.text')}</p>
      ${fired && html`<${Said} text=${`${t('core.voice.orari')} ${t('demo.market.text')}`} />`}`,
    here: () => html`
      <${Place} icon="map-pin" text=${t('demo.place.gate')} />
      <${Card} title=${t('demo.here.title')} icon="map-pin">${dogRow}<//>
      <p class="f-demo-hint">${t('demo.here.caption')}</p>
      <${Said} text=${t('core.voice.cane')} />`,
    end: () => html`
      <div class="f-demo-art"><${Art} name="hero" alt=${t('demo.start.art')} /></div>
      <${Card} icon="clock" title=${t('demo.end.week')} />
      <p class="f-demo-hint">${t('demo.end.yours')}</p>`,
  }[phase];

  return html`<${Screen} title=${t('demo.title')} banner=${false}
    sticky=${phase === 'end' && html`
      <${Button} block size="xl" icon="play" label=${t('demo.end.start')} onClick=${exitDemo} />
      <${Button} block variant="ghost" icon="refresh-cw" label=${t('demo.end.again')} busy=${again.busy}
        onClick=${() => again.run()} />`}>
    <${DemoBanner} />
    <${Progress} elapsed=${elapsed} beat=${beatOf(phase)} />
    <section class="f-demo-stage" key=${phase}>${stage()}</section>
  <//>`;
}

export default function DemoScreen() {
  useLang();
  const shift = useStore((s) => s.shift);
  const sandboxOn = useStore((s) => s.sandbox);
  // Back on this route while the sandbox is still on: show the end card.
  const [run, setRun] = useState(() => (demoActive()
    ? { id: 1, initial: { elapsed: TIMES.total, savedAt: clock.now(), stoppedS: 0, fired: true } } : null));
  const start = useAction(async () => {
    await startDemo();
    setRun({ id: 1, initial: {} });
  });
  if (run) {
    return html`<${Player} key=${run.id} initial=${run.initial}
      onReplay=${() => setRun({ id: run.id + 1, initial: {} })} />`;
  }
  const blocked = Boolean(shift) && !sandboxOn;
  return html`<${Screen} title=${t('demo.title')} back="/" banner=${false}
    sticky=${html`<${Button} block size="xl" icon="play" label=${t('demo.start.go')} busy=${start.busy}
      disabled=${blocked} onClick=${() => start.run()} />`}>
    ${blocked && html`<${Banner} tone="warning" icon="info" text=${t('core.err.demoShift')} />`}
    <div class="f-demo-stage">
      <div class="f-demo-art"><${Art} name="hero" alt=${t('demo.start.art')} /></div>
      <p class="f-demo-hint">${t('demo.start.lead')}</p>
      <p class="f-demo-volume"><${Icon} name="volume-2" size=${32} /><span>${t('demo.start.volume')}</span></p>
    </div>
  <//>`;
}
