// @ts-check
import { html, useEffect, useState } from '../../../ui/html.js';
import { useStore, useTick, useSetting, useSlot, useAction } from '../../../ui/hooks.js';
import {
  Screen, Button, Sheet, Tile, Tag, List, ListRow, SlotOutlet, confirm, setShiftContrast, shiftContrast,
} from '../../../ui/kit/index.js';
import { t, session, speech, presenter, router, format } from '../../../core/api.js';
import { breakState, countdown } from '../logic/shift-math.js';
import * as state from '../state.js';
import { Briefing } from './briefing.js';

const LAST_ALERT_MS = 120000;

function gpsTag(shift, gps) {
  if (shift.mode === 'pocket') return { label: t('core.tag.noDriveAlerts'), icon: 'locate-fixed' };
  if (gps.state === 'ok') return { label: t('core.tag.gps', { n: Math.round(gps.acc ?? 0) }), tone: 'success', icon: 'locate-fixed' };
  if (gps.state === 'imprecise' || gps.state === 'coarse') {
    return { label: t('turno.tag.gpsImprecise'), tone: 'warning', icon: 'locate-fixed' };
  }
  if (gps.state === 'starting') return { label: t('turno.tag.gpsSearching'), icon: 'locate-fixed' };
  if (gps.state === 'paused' || gps.state === 'unavailable') {
    return { label: t('turno.tag.gpsLost'), tone: 'danger', icon: 'locate-fixed' };
  }
  return { label: t('core.tag.gpsOff'), tone: 'danger', icon: 'locate-fixed' };
}

function BreakSheet({ shift, now, onClose }) {
  const [breakMin] = useSetting('shift.breakMin');
  const b = breakState(shift, now);
  const startBreak = useAction(() => session.startBreak());
  const endBreak = useAction(async () => {
    await session.endBreak();
    onClose();
  });
  const here = () => {
    onClose();
    router.navigate('/vicino', { query: { pausa: '1' } });
  };
  const footer = b.running
    ? html`<${Button} block size="xl" icon="play" label=${t('turno.break.end')} busy=${endBreak.busy}
        onClick=${endBreak.run} />`
    : html`<${Button} block size="xl" icon="coffee" label=${t('turno.break.start')} busy=${startBreak.busy}
        onClick=${startBreak.run} />`;
  return html`<${Sheet} open title=${t('turno.break.title')} onClose=${onClose} footer=${footer}>
    <div class="stack">
      <p class="t-display-l num f-turno-count" role="timer">${countdown(b.running ? b.leftMs : breakMin * 60000)}</p>
      ${b.running && html`<p class="t-body-m t-center">
        ${b.leftMs > 0 ? t('turno.break.endsAt', { time: format.time(b.endsAt) }) : t('core.say.breakEnd')}
      </p>`}
      <div class="btn-row">
        ${b.running && html`<${Button} variant="secondary" icon="plus" label=${t('turno.break.plus')}
          onClick=${() => session.extendBreak(5)} />`}
        <${Button} variant="secondary" icon="toilet" label=${t('turno.break.here')} onClick=${here} />
      </div>
      <p class="t-caption t-muted">${t('turno.break.caption')}</p>
    </div>
  <//>`;
}

function AutoLockSheet({ onClose }) {
  return html`<${Sheet} open title=${t('turno.autolock.title')} onClose=${onClose}
    footer=${html`<${Button} block label=${t('turno.autolock.done')} onClick=${onClose} />`}>
    <p class="t-body-m">${t('turno.autolock.text')}</p>
  <//>`;
}

/** Home during a shift (SPEC 2.5). @param {{shift:import('../../../core/types.js').Shift}} props */
export default function ShiftHome({ shift }) {
  const now = useTick(1000);
  const gps = useStore((s) => s.gps);
  const wake = useStore((s) => s.wake);
  const audio = useStore((s) => s.audio);
  const voice = useStore((s) => s.voice);
  const passenger = useStore((s) => s.passenger);
  const moving = useStore((s) => s.moving && !s.passenger);
  const lastAlert = useStore((s) => s.lastAlert);
  const [breakMin] = useSetting('shift.breakMin');
  const stickyItems = useSlot('home.sticky');
  const [sheet, setSheet] = useState(() => (state.takeBriefing(shift.id) ? 'briefing' : null));
  const [contrast, setContrast] = useState(() => shiftContrast());
  /** undefined while the flag is being read */
  const [autoLockId, setAutoLockId] = useState(/** @type {string|null|undefined} */ (undefined));

  useEffect(() => {
    state.autoLockShiftId().then(setAutoLockId);
  }, []);
  // No wake lock (iOS below 18.4, or refused): explain Auto-Lock once per shift, after the briefing.
  useEffect(() => {
    if (shift.mode !== 'holder' || wake !== 'none' || sheet !== null || moving) return;
    if (autoLockId === undefined || autoLockId === shift.id) return;
    setAutoLockId(shift.id);
    state.markAutoLock(shift.id);
    setSheet('autolock');
  }, [shift.mode, shift.id, wake, sheet, moving, autoLockId]);

  const end = useAction(async () => {
    const ok = await confirm({ icon: 'square', title: t('turno.end.ask'), confirm: t('turno.end'),
      cancel: t('turno.end.keep') });
    if (ok) await session.endShift();
  });
  const testVoice = () => {
    session.rearmAudio();
    speech.say(t('core.say.audioOk'));
  };
  const toggleContrast = () => {
    setShiftContrast(!contrast);
    setContrast(!contrast);
  };

  const b = breakState(shift, now);
  const soundOk = audio === 'ok' && voice === 'ok';
  const voiceLabel = soundOk ? t('core.tag.voiceOn') : t('core.tag.voiceOff');
  const tags = html`
    <${Tag} ...${gpsTag(shift, gps)} />
    ${shift.mode === 'holder' && wake !== 'off' && html`<${Tag} icon="sun"
      label=${wake === 'native' ? t('core.tag.screenOn') : t('turno.tag.screenSleeps')}
      tone=${wake === 'native' ? 'success' : 'warning'} />`}
    ${moving
      ? html`<${Tag} icon=${soundOk ? 'volume-2' : 'volume-x'} label=${voiceLabel} tone=${soundOk ? 'success' : 'danger'} />`
      : html`<${Button} variant=${soundOk ? 'secondary' : 'danger'} icon=${soundOk ? 'volume-2' : 'volume-x'}
          label=${voiceLabel} onClick=${testVoice} />`}
    ${passenger && html`<${Tag} icon="user" label=${t('core.tag.passenger')} tone="info" />`}`;

  const rearm = audio === 'locked' && !moving;
  const sticky = (rearm || stickyItems.length > 0) && html`<div class="stack">
    ${rearm && html`<${Button} variant="secondary" size="xl" block icon="volume-2" label=${t('core.banner.rearm')}
      onClick=${() => session.rearmAudio()} />`}
    ${stickyItems.length > 0 && html`<div class="btn-row"><${SlotOutlet} name="home.sticky" /></div>`}
  </div>`;
  // "Segnala" stays one tap away: as a tile here unless its feature already put a button in the bar.
  const reportTile = !stickyItems.some((s) => s.featureId === 'segnala');
  const showLast = lastAlert && now - lastAlert.at < LAST_ALERT_MS;

  return html`<${Screen} title=${t('turno.shift.title', { d: format.duration(now - shift.startAt) })} tags=${tags}
    sticky=${sticky}
    action=${html`<${Button} variant=${contrast ? 'secondary' : 'ghost'} iconOnly icon="sun" label=${t('turno.sun')}
      onClick=${toggleContrast} />`}>
    <div class="stack">
      ${showLast && html`<${List}>
        <${ListRow} icon="bell-ring" tone=${lastAlert.card.tone} chevron onClick=${() => presenter.reopenLast()}
          title=${t('turno.lastAlert', { title: lastAlert.card.title, dist: format.distance(lastAlert.card.distM) })} />
      <//>`}
      <${SlotOutlet} name="home.shift" />
      <div class="tiles f-turno-tiles">
        <${Tile} icon="coffee" label=${t('turno.tile.break')} primary=${b.running}
          value=${b.running ? countdown(b.leftMs) : t('core.fmt.min', { n: breakMin })}
          onClick=${() => setSheet('break')} />
        ${reportTile && html`<${Tile} icon="megaphone" label=${t('turno.tile.report')} href=${router.href('/segnala')} />`}
        <${Tile} icon="square" label=${t('turno.end')} tone="danger" onClick=${end.run} />
      </div>
    </div>
    ${sheet === 'briefing' && html`<${Briefing} shift=${shift} onClose=${() => setSheet(null)} />`}
    ${sheet === 'break' && html`<${BreakSheet} shift=${shift} now=${now} onClose=${() => setSheet(null)} />`}
    ${sheet === 'autolock' && html`<${AutoLockSheet} onClose=${() => setSheet(null)} />`}
  <//>`;
}
