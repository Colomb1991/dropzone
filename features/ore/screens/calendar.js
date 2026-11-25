// @ts-check
// The month at a glance: days with a recorded shift are filled, today is outlined. A tap on a day
// with shifts opens it; a tap on an empty day, today or earlier, offers "Segna come lavorato".
import { html } from '../../../ui/html.js';
import { useAction } from '../../../ui/hooks.js';
import { Sheet, Button, List, ListRow, confirm, toast, sectionAccent } from '../../../ui/kit/index.js';
import { t, shifts, settings, format, log } from '../../../core/api.js';
import { shiftTotals } from '../logic/hours.js';
import { fullDayMinutes, fullDayShift } from '../logic/calendar.js';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
/** "mer 25 nov" */
export const dayLabel = (ts) => `${format.weekday(((new Date(ts).getDay() + 6) % 7) + 1, 'short')} ${format.dateShort(ts)}`;
/** "A mano" for a shift added by hand, "Modificato" for a recorded one that was changed. */
export const shiftTags = (shift) => (shift.manual ? [{ label: t('ore.tag.manual'), icon: 'pencil' }]
  : shift.edited ? [{ label: t('core.tag.edited'), icon: 'pencil' }] : undefined);

/**
 * @param {{cal:ReturnType<typeof import('../logic/calendar.js').monthCalendar>,
 *   onDay:(day:import('../logic/calendar.js').CalDay)=>void}} props
 */
export function MonthCalendar({ cal, onDay }) {
  const say = (d) => {
    const what = d.worked ? t('ore.cal.worked', { d: format.duration(d.workedMs) }) : t('ore.cal.none');
    return `${format.dateLong(d.ts)}${d.today ? `, ${t('ore.cal.today')}` : ''}: ${what}`;
  };
  return html`<section class="f-ore-cal" data-accent=${sectionAccent('ore')}
    aria-label=${t('ore.cal.label', { month: format.monthTitle(cal.year, cal.month) })}>
    <div class="f-ore-cal__grid f-ore-cal__names" aria-hidden="true">
      ${WEEKDAYS.map((n) => html`<span>${format.weekday(n, 'short')}</span>`)}
    </div>
    ${cal.weeks.map((week) => html`<div class="f-ore-cal__grid">
      ${week.map((d) => (d === null ? html`<span></span>`
        : html`<button type="button" class="f-ore-cal__day" key=${d.key} aria-label=${say(d)}
            data-worked=${d.worked ? '' : null} aria-current=${d.today ? 'date' : null}
            disabled=${d.future || null} onClick=${() => onDay(d)}><span class="num">${d.day}</span></button>`))}
    </div>`)}
    <p class="f-ore-cal__sum">${t('ore.cal.summary', { n: cal.workedDays, d: format.duration(cal.workedMs) })}</p>
  </section>`;
}

/**
 * A day with shifts: each one opens its edit form. A day made only of one shift added by hand
 * can be taken off here, after a confirmation.
 * @param {{day:import('../logic/calendar.js').CalDay, breakPaid:boolean, now:number,
 *   onEdit:(shift:any)=>void, onClose:()=>void}} props
 */
export function DaySheet({ day, breakPaid, now, onEdit, onClose }) {
  const only = day.manual && day.shifts.length === 1 ? day.shifts[0] : null;
  const remove = useAction(async () => {
    if (!only) return;
    const ok = await confirm({ icon: 'trash-2', danger: true, title: t('ore.mark.removeAsk'),
      text: t('ore.mark.removeText'), confirm: t('ore.mark.remove'), cancel: t('ore.edit.keep') });
    if (!ok) return;
    await shifts.deleteShift(only.id);
    toast(t('ore.mark.removed'));
    onClose();
  });
  const dur = format.duration;
  return html`<${Sheet} open title=${dayLabel(day.ts)} onClose=${onClose}
    footer=${only && html`<${Button} block variant="ghost" icon="trash-2" label=${t('ore.mark.remove')}
      busy=${remove.busy} onClick=${remove.run} />`}>
    <${List} label=${dayLabel(day.ts)}>
      ${day.shifts.map((s) => {
        const tot = shiftTotals(s, breakPaid, now);
        if (tot.open) {
          return html`<${ListRow} key=${s.id} icon="play" title=${t('ore.cal.running', { from: format.time(s.startAt) })}
            value=${dur(tot.workedMs)} />`;
        }
        return html`<${ListRow} key=${s.id} icon="clock" chevron tags=${shiftTags(s)}
          title=${t('ore.week.range', { from: format.time(s.startAt), to: format.time(s.endAt) })}
          sub=${t('ore.cal.shiftSub', { worked: dur(tot.workedMs), pause: dur(tot.breakMs) })}
          onClick=${() => onEdit(s)} />`;
      })}
    <//>
  <//>`;
}

/**
 * "Segna come lavorato" on an empty day: the contract's daily hours in one tap, or the form of
 * "Aggiungi turno" on that date. Either way an ordinary shift, marked as added by hand.
 * @param {{day:import('../logic/calendar.js').CalDay, now:number, onWrite:()=>void, onClose:()=>void}} props
 */
export function MarkSheet({ day, now, onWrite, onClose }) {
  const weeklyHours = settings.get('contract.weeklyHours');
  const minutes = fullDayMinutes({ weeklyHours, daysPerWeek: settings.get('contract.daysPerWeek') });
  const times = fullDayShift({ dayTs: day.ts, minutes, now });
  const d = format.duration(minutes * 60000);
  const full = useAction(async () => {
    if (!times) return;
    const id = crypto.randomUUID();
    await shifts.saveShift({ id, ...times, mode: settings.get('shift.mode') ?? 'holder', edited: true, manual: true,
      alertsFired: 0, lastSeenAt: times.endAt });
    onClose();
    // A wrong tap is one tap away from undone.
    toast(t('ore.mark.done'), { icon: 'check',
      action: { label: t('core.action.undo'), onClick: () => shifts.deleteShift(id).catch((err) => log.error('ore', err)) } });
  });
  const footer = html`<div class="stack">
    <${Button} block icon="check" label=${t('ore.mark.full', { d })} disabled=${!times}
      reason=${t('ore.mark.early', { d })} busy=${full.busy} onClick=${full.run} />
    <${Button} block variant="secondary" icon="pencil" label=${t('ore.mark.write')} onClick=${onWrite} />
  </div>`;
  return html`<${Sheet} open title=${t('ore.mark.title')} onClose=${onClose} footer=${footer}>
    <div class="stack">
      <p class="t-title-m">${dayLabel(day.ts)}</p>
      <p class="t-body-m t-muted">${t(weeklyHours == null ? 'ore.mark.helpDefault' : 'ore.mark.help', { d })}</p>
    </div>
  <//>`;
}
