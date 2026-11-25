// @ts-check
import { html, useEffect, useRef, useState } from '../../../ui/html.js';
import { useStore, useSetting, useLive, useAction } from '../../../ui/hooks.js';
import { Sheet, Button, Tile, Tiles, List, ListRow, Keypad, keypadTime, toast } from '../../../ui/kit/index.js';
import { t, session, settings, slots, format, clock } from '../../../core/api.js';
import { startFromTime } from '../logic/shift-math.js';

const AUTO_CLOSE_MS = 20000;

/**
 * "Oggi occhio a" (SPEC 3.2): start time with "Cambia", the mode question on the first shift, what
 * the other features report for today. Closes when moving, or after 20 s if nobody touched it.
 * @param {{shift:import('../../../core/types.js').Shift, onClose:()=>void}} props
 */
export function Briefing({ shift, onClose }) {
  const [mode] = useSetting('shift.mode');
  const moving = useStore((s) => s.moving && !s.passenger);
  const [changing, setChanging] = useState(false);
  const [digits, setDigits] = useState('');
  const touched = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  const items = useLive(['notes'], () => slots.collect('briefing', { now: clock.now(), shift }), [shift.id]);

  useEffect(() => {
    if (moving) close.current();
  }, [moving]);
  useEffect(() => {
    // The mode question needs an answer: no timer until it is given.
    if (mode === null) return undefined;
    const id = setTimeout(() => {
      if (!touched.current) close.current();
    }, AUTO_CLOSE_MS);
    return () => clearTimeout(id);
  }, [mode]);

  const applyStart = useAction(async () => {
    const hhmm = keypadTime(digits);
    const startAt = hhmm ? startFromTime(hhmm, clock.now()) : null;
    if (startAt === null) {
      toast(t('turno.briefing.changeBad'), { icon: 'triangle-alert' });
      return;
    }
    await session.setStart(startAt);
    setChanging(false);
    setDigits('');
  });
  const pickMode = useAction((m) => settings.set('shift.mode', m));

  const rows = items.data ?? [];
  return html`<${Sheet} open title=${t('turno.briefing.title')} onClose=${onClose}
    footer=${html`<${Button} block size="xl" label=${t('turno.briefing.go')} onClick=${onClose} />`}>
    <div class="stack" onPointerDown=${() => {
      touched.current = true;
    }}>
      <${List}>
        <${ListRow} icon="clock" title=${t('turno.briefing.started', { time: format.time(shift.startAt) })}
          tags=${shift.edited ? [{ label: t('core.tag.edited'), icon: 'pencil' }] : undefined}
          trailing=${html`<${Button} variant="ghost" label=${t('turno.briefing.change')}
            onClick=${() => setChanging(!changing)} />`} />
      <//>
      ${changing && html`<${Keypad} mode="time" value=${digits} label=${t('turno.briefing.changeLabel')}
        onChange=${setDigits} onDone=${applyStart.run} />`}
      ${mode === null && html`
        <h3 class="t-label f-turno-q">${t('turno.briefing.where')}</h3>
        <${Tiles}>
          <${Tile} icon="car" label=${t('turno.mode.holder')} value=${t('turno.mode.holderSub')}
            onClick=${() => pickMode.run('holder')} />
          <${Tile} icon="user" label=${t('turno.mode.pocket')} value=${t('turno.mode.pocketSub')}
            onClick=${() => pickMode.run('pocket')} />
        <//>`}
      ${rows.length > 0
        ? html`<${List}>${rows.map((r) => html`<${ListRow} icon=${r.icon ?? 'info'} title=${r.text} />`)}<//>`
        : !items.loading && html`<p class="t-body-m">${t('turno.briefing.none')}</p>`}
      <p class="t-caption t-muted">${t('turno.briefing.silent')}</p>
      ${mode !== 'pocket' && html`<p class="t-caption t-muted">${t('turno.briefing.road')}</p>`}
    </div>
  <//>`;
}
