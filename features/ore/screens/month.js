// @ts-check
import { html, useMemo, useState } from '../../../ui/html.js';
import { useLive, useLang, useSetting, useTick, useAction } from '../../../ui/hooks.js';
import { Screen, Button, List, ListRow, Empty } from '../../../ui/kit/index.js';
import { t, tn, shifts, share, format, router, clock } from '../../../core/api.js';
import { monthSummary, monthRange } from '../logic/hours.js';
import { monthCsv, csvFileName } from '../logic/csv.js';
import { EditSheet } from './edit-sheet.js';

const ymOf = (ts) => {
  const d = new Date(ts);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
};
const step = (ym, by) => ymOf(new Date(ym.y, ym.m - 1 + by, 1).getTime());
const dayLabel = (ts) => `${format.weekday(((new Date(ts).getDay() + 6) % 7) + 1, 'short')} ${format.dateShort(ts)}`;

function ShiftRow({ row, onEdit }) {
  const { shift, totals } = row;
  const day = dayLabel(shift.startAt);
  if (totals.open) {
    return html`<${ListRow} icon="play" title=${t('ore.day.running', { day, from: format.time(shift.startAt) })}
      value=${format.duration(totals.workedMs)} />`;
  }
  return html`<${ListRow} icon="clock"
    title=${t('ore.day.title', { day, from: format.time(shift.startAt), to: format.time(shift.endAt) })}
    sub=${t('ore.day.sub', { inShift: format.duration(totals.inShiftMs), worked: format.duration(totals.workedMs),
      pause: format.duration(totals.breakMs) })}
    tags=${shift.edited ? [{ label: t('core.tag.edited'), icon: 'pencil' }] : undefined}
    chevron onClick=${() => onEdit(shift)} />`;
}

export default function OreScreen() {
  useLang();
  const now = useTick(60000);
  const [ym, setYm] = useState(() => ymOf(clock.now()));
  const [weeklyHours] = useSetting('contract.weeklyHours');
  const [breakPaid] = useSetting('contract.breakPaid');
  /** null = closed, 'add', or the shift being edited */
  const [editing, setEditing] = useState(/** @type {any} */ (null));

  const live = useLive(['shifts'], () => {
    const r = monthRange(ym.y, ym.m);
    return shifts.listShifts({ from: r.from, to: r.to });
  }, [ym.y, ym.m]);
  const list = live.data ?? [];
  const sum = useMemo(() => monthSummary(list, ym.y, ym.m, { weeklyHours, breakPaid: breakPaid === true, now }),
    [list, ym.y, ym.m, weeklyHours, breakPaid, now]);

  // Prepare, then tap: the file exists before the button is enabled (SPEC 6.4).
  const file = useMemo(() => {
    if (typeof File === 'undefined' || !list.some((s) => s.endAt !== null)) return null;
    const csv = monthCsv(list, { year: ym.y, month: ym.m, breakPaid: breakPaid === true,
      footer: t('ore.csv.footer'), yes: t('ore.csv.yes'), no: t('ore.csv.no') });
    return share.makeFile(csvFileName(ym.y, ym.m), 'text/csv', [csv]);
  }, [list, ym.y, ym.m, breakPaid]);
  const canExport = file !== null && sum.weeks.some((w) => w.rows.some((r) => !r.totals.open));
  const exportCsv = useAction(() => share.shareFiles([file]).then((res) => {
    if (res === 'unsupported') share.downloadFile(file);
  }));

  const cur = ymOf(now);
  const isCurrent = ym.y === cur.y && ym.m === cur.m;
  const dur = format.duration;

  return html`<${Screen} title=${t('ore.title')} back="/altro">
    <div class="stack">
      <div class="f-ore-month">
        <${Button} variant="ghost" iconOnly icon="chevron-left" label=${t('ore.month.prev')}
          onClick=${() => setYm(step(ym, -1))} />
        <h2 class="t-title-m f-ore-month__name" aria-live="polite">${format.monthTitle(ym.y, ym.m)}</h2>
        <${Button} variant="ghost" iconOnly icon="chevron-right" label=${t('ore.month.next')} disabled=${isCurrent}
          onClick=${() => setYm(step(ym, 1))} />
      </div>

      ${live.loading && !live.data && html`<p class="loading">${t('core.state.loading')}</p>`}
      ${live.data && sum.count === 0 && html`<${Empty} icon="calendar-days" title=${t('ore.empty')} />`}

      ${sum.count > 0 && html`<${List} label=${format.monthTitle(ym.y, ym.m)}>
        <${ListRow} title=${t('ore.stat.inShift')} value=${dur(sum.inShiftMs)} />
        <${ListRow} title=${t('ore.stat.worked')} value=${dur(sum.workedMs)} />
        <${ListRow} title=${t('ore.stat.breaks')} value=${dur(sum.breakMs)} />
        <${ListRow} title=${t('ore.stat.days')} value=${String(sum.days)} />
        ${sum.overMs !== null && html`<${ListRow} title=${t('ore.stat.over')} sub=${t('ore.stat.overHelp')}
          value=${dur(sum.overMs)} />`}
      <//>`}
      ${weeklyHours == null && html`<${List}>
        <${ListRow} icon="settings" title=${t('ore.contract.set')} sub=${t('ore.contract.setSub')} chevron
          href=${router.href('/impostazioni')} />
      <//>`}

      ${sum.weeks.map((w) => html`
        <h3 class="section-title">
          ${t('ore.week.head', { d: dur(w.workedMs),
            range: t('ore.week.range', { from: format.dateShort(w.startAt), to: format.dateShort(w.lastDay) }) })}
          ${w.endsInMonth && w.overMs > 0 ? ` · ${t('ore.over', { d: dur(w.overMs) })}` : ''}
        </h3>
        <${List} label=${tn('ore.days', w.days, { n: w.days })}>
          ${w.rows.map((row) => html`<${ShiftRow} key=${row.shift.id} row=${row} onEdit=${setEditing} />`)}
        <//>`)}

      <div class="f-ore-actions">
        <${Button} variant="secondary" block icon="plus" label=${t('ore.add')} onClick=${() => setEditing('add')} />
        <${Button} variant="secondary" block icon="file-down" label=${t('ore.export')} disabled=${!canExport}
          reason=${t('ore.export.none')} busy=${exportCsv.busy} onClick=${exportCsv.run} />
        <p class="t-caption t-muted">${t('ore.notProof')} ${t('ore.rules')}</p>
      </div>
    </div>
    ${editing && html`<${EditSheet} shift=${editing === 'add' ? null : editing} ym=${ym} now=${now}
      onClose=${() => setEditing(null)} />`}
  <//>`;
}
