// @ts-check
import { html, useEffect, useState } from '../../../ui/html.js';
import { useSetting, useLive, useAction } from '../../../ui/hooks.js';
import {
  Screen, Button, Sheet, Chips, Chip, Stepper, Toggle, List, ListRow, Icon, sectionAccent,
} from '../../../ui/kit/index.js';
import { t, tn, settings, slots, router, format } from '../../../core/api.js';
import { shiftStats, closing, validWeeklyHours } from '../logic/shift-math.js';
import * as state from '../state.js';

const HOUR_CHIPS = [39, 40, 42, 44];

/** Contratto (SPEC 3.2): asked once, before the first end card. "Dopo" leaves the contract unset. */
function ContractSheet({ onClose }) {
  const [hours, setHours] = useState(() => settings.get('contract.weeklyHours') ?? 40);
  const [other, setOther] = useState(() => !HOUR_CHIPS.includes(settings.get('contract.weeklyHours') ?? 40));
  const [days, setDays] = useState(() => settings.get('contract.daysPerWeek') ?? 5);
  const [paid, setPaid] = useState(() => settings.get('contract.breakPaid') === true);
  const save = useAction(async () => {
    await settings.set('contract.weeklyHours', hours);
    await settings.set('contract.daysPerWeek', days);
    await settings.set('contract.breakPaid', paid);
    await state.markContractAsked();
    onClose();
  });
  const later = () => {
    state.markContractAsked();
    onClose();
  };
  const footer = html`<div class="stack">
    <${Button} block label=${t('core.action.save')} disabled=${!validWeeklyHours(hours)} busy=${save.busy}
      onClick=${save.run} />
    <${Button} block variant="ghost" label=${t('turno.contract.later')} onClick=${later} />
  </div>`;
  return html`<${Sheet} open title=${t('turno.contract.title')} onClose=${later} footer=${footer}>
    <div class="stack">
      <h3 class="t-label f-turno-q">${t('turno.contract.hours')}</h3>
      <${Chips} label=${t('turno.contract.hours')}>
        ${HOUR_CHIPS.map((h) => html`<${Chip} label=${String(h)} pressed=${!other && hours === h}
          onToggle=${() => {
            setOther(false);
            setHours(h);
          }} />`)}
        <${Chip} label=${t('turno.contract.other')} pressed=${other} onToggle=${() => setOther(true)} />
      <//>
      ${other && html`<${Stepper} label=${t('turno.contract.otherLabel')} value=${hours} min=${20} max=${48}
        step=${0.5} format=${(n) => format.number(n, 1)} onChange=${setHours} />`}
      <h3 class="t-label f-turno-q">${t('turno.contract.days')}</h3>
      <${Chips} label=${t('turno.contract.days')}>
        ${[5, 6].map((d) => html`<${Chip} label=${String(d)} pressed=${days === d} onToggle=${() => setDays(d)} />`)}
      <//>
      <${Toggle} label=${t('turno.contract.paid')} checked=${paid} onChange=${setPaid} />
    </div>
  <//>`;
}

/**
 * Fine turno (SPEC 3.2). Lines and rows of the other features come from the `shift.end` slot.
 * @param {{shift:import('../../../core/types.js').Shift, onDone:()=>void}} props
 */
export function EndCard({ shift, onDone }) {
  const [breakPaid] = useSetting('contract.breakPaid');
  const [weeklyHours] = useSetting('contract.weeklyHours');
  const [askContract, setAskContract] = useState(false);
  const [autoLock, setAutoLock] = useState(false);
  const extra = useLive(['notes', 'shifts'], () => slots.collect('shift.end', { shift }),
    [shift.id, weeklyHours, breakPaid]);

  useEffect(() => {
    let alive = true;
    if (settings.get('contract.weeklyHours') == null) {
      state.contractAsked().then((asked) => alive && !asked && setAskContract(true));
    }
    state.autoLockShiftId().then((id) => alive && setAutoLock(id === shift.id));
    return () => {
      alive = false;
    };
  }, [shift.id]);

  const s = shiftStats(shift, breakPaid === true, shift.endAt ?? shift.startAt);
  const items = extra.data ?? [];
  const lines = items.filter((x) => x.kind !== 'row');
  const rows = items.filter((x) => x.kind === 'row');
  const line = (icon, text) => html`<p class="t-body-m f-turno-line"><${Icon} name=${icon} /><span>${text}</span></p>`;

  return html`<${Screen} title=${t('turno.done.title')}
    sticky=${html`<${Button} block size="xl" label=${t('core.action.done')} onClick=${onDone} />`}>
    <div class="stack">
      <${List}>
        <${ListRow} title=${t('turno.stat.inShift')} value=${format.duration(s.inShiftMs)}
          tags=${shift.edited ? [{ label: t('core.tag.edited'), icon: 'pencil' }] : undefined} />
        <${ListRow} title=${t('turno.stat.worked')} value=${format.duration(s.workedMs)} />
        <${ListRow} title=${t('turno.stat.break')} value=${format.duration(s.breakMs)} />
      <//>
      ${lines.map((x) => line(x.icon ?? 'info', x.text))}
      ${shift.alertsFired > 0 && line('bell-ring', tn('turno.done.alerts', shift.alertsFired, { n: shift.alertsFired }))}
      ${autoLock && line('lock', t('turno.done.autolock'))}
      ${rows.length > 0 && html`<${List}>
        ${rows.map((x) => html`<${ListRow} icon=${x.icon ?? 'info'} accent=${sectionAccent(x.featureId)} title=${x.text}
          chevron=${Boolean(x.to)}
          href=${x.to ? router.href(x.to) : undefined} />`)}
      <//>`}
      <p class="t-title-m">${t(`turno.done.${closing(s.inShiftMs)}`)}</p>
    </div>
    ${askContract && html`<${ContractSheet} onClose=${() => setAskContract(false)} />`}
  <//>`;
}
