// @ts-check
import { html, useState } from '../../../ui/html.js';
import { useAction } from '../../../ui/hooks.js';
import { Sheet, Button, Chips, Chip, Keypad, keypadTime, Stepper, confirm, toast } from '../../../ui/kit/index.js';
import { t, shifts, settings, format } from '../../../core/api.js';
import { buildShiftTimes, shiftTotals, timeDigits } from '../logic/hours.js';

const FIELDS = ['start', 'end', 'break'];
const dayLabel = (ts) => `${format.weekday(((new Date(ts).getDay() + 6) % 7) + 1, 'short')} ${format.dateShort(ts)}`;

/**
 * Edit start, end and break minutes of a closed shift, or add one, with the in-app keypad (SPEC 6.4).
 * @param {{shift:import('../logic/hours.js').ShiftLike|null, ym:{y:number, m:number}, now:number,
 *   onClose:()=>void}} props  `shift: null` adds a shift in the month shown
 */
export function EditSheet({ shift, ym, now, onClose }) {
  const today = new Date(now);
  const thisMonth = today.getFullYear() === ym.y && today.getMonth() + 1 === ym.m;
  const maxDay = thisMonth ? today.getDate() : new Date(ym.y, ym.m, 0).getDate();
  const origBreakMin = shift ? Math.round(shiftTotals(shift, false, now).breakMs / 60000) : 30;

  const [day, setDay] = useState(maxDay);
  const [values, setValues] = useState(() => ({
    start: shift ? timeDigits(shift.startAt) : '0800',
    end: shift ? timeDigits(/** @type {number} */ (shift.endAt)) : '1700',
    break: String(origBreakMin),
  }));
  // The first key typed in a field replaces what was there.
  const [active, setActive] = useState({ field: 'start', fresh: true });

  const dayTs = shift ? shift.startAt : new Date(ym.y, ym.m - 1, day).getTime();
  const start = keypadTime(values.start);
  const end = keypadTime(values.end);
  const breakMin = values.break === '' ? 0 : Number(values.break);
  const built = start && end ? buildShiftTimes({ dayTs, start, end, breakMin, now }) : null;

  const type = (v) => {
    const cur = values[active.field];
    const next = active.fresh && v.length > cur.length ? v.slice(-1) : v;
    setValues({ ...values, [active.field]: next });
    setActive({ field: active.field, fresh: false });
  };
  const pick = (field) => setActive({ field, fresh: true });
  const nextField = () => pick(FIELDS[Math.min(FIELDS.length - 1, FIELDS.indexOf(active.field) + 1)]);

  const save = useAction(async () => {
    if (!built) return;
    if (shift) {
      // Recorded breaks are kept unless their total was changed here.
      const patch = { startAt: built.startAt, endAt: built.endAt };
      await shifts.editShift(shift.id, breakMin === origBreakMin ? patch : { ...patch, breaks: built.breaks });
    } else {
      await shifts.saveShift({ id: crypto.randomUUID(), ...built, mode: settings.get('shift.mode') ?? 'holder',
        edited: true, alertsFired: 0, lastSeenAt: built.endAt });
    }
    toast(t('ore.edit.saved'), { icon: 'check' });
    onClose();
  });
  const remove = useAction(async () => {
    if (!shift) return;
    const ok = await confirm({ icon: 'trash-2', danger: true, title: t('ore.edit.deleteAsk'),
      confirm: t('ore.edit.delete'), cancel: t('ore.edit.keep') });
    if (!ok) return;
    await shifts.deleteShift(shift.id);
    toast(t('ore.edit.deleted'));
    onClose();
  });

  const show = (digits) => keypadTime(digits) ?? '–';
  const footer = html`<div class="stack">
    <${Button} block label=${t('core.action.save')} disabled=${!built} reason=${t('ore.edit.bad')} busy=${save.busy}
      onClick=${save.run} />
    ${shift && html`<${Button} block variant="ghost" icon="trash-2" label=${t('ore.edit.delete')}
      onClick=${remove.run} />`}
  </div>`;

  return html`<${Sheet} open title=${shift ? t('ore.edit.title') : t('ore.add')} onClose=${onClose} footer=${footer}>
    <div class="stack">
      ${shift
        ? html`<p class="t-title-s">${dayLabel(dayTs)}</p>`
        : html`<${Stepper} label=${t('ore.edit.day')} value=${day} min=${1} max=${maxDay} step=${1}
            format=${(n) => dayLabel(new Date(ym.y, ym.m - 1, n).getTime())} onChange=${setDay} />`}
      <${Chips} label=${t('ore.edit.what')}>
        <${Chip} label=${t('ore.edit.start', { v: show(values.start) })} pressed=${active.field === 'start'}
          onToggle=${() => pick('start')} />
        <${Chip} label=${t('ore.edit.end', { v: show(values.end) })} pressed=${active.field === 'end'}
          onToggle=${() => pick('end')} />
        <${Chip} label=${t('ore.edit.break', { v: values.break === '' ? '0' : values.break })}
          pressed=${active.field === 'break'} onToggle=${() => pick('break')} />
      <//>
      <${Keypad} value=${values[active.field]} mode=${active.field === 'break' ? 'digits' : 'time'} max=${3}
        label=${t('ore.edit.what')} onChange=${type} onDone=${nextField} />
    </div>
  <//>`;
}
