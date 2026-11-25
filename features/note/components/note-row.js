// @ts-check
import { html, useRef } from '../../../ui/html.js';
import { t, format, router } from '../../../core/api.js';
import { useAction, useFix } from '../../../ui/hooks.js';
import { ListRow, Button } from '../../../ui/kit/index.js';
import { category, catLabelKey } from '../../../core/pure/catalog.js';
import { isScheduleActive } from '../../../core/pure/schedule.js';
import { distM } from '../../../core/pure/geo-math.js';
import { visitInfo } from '../logic/note-view.js';
import { stampVisit } from '../logic/actions.js';

const MOVE_M = 25;

/** The position, renewed only after 25 m, so lists do not reorder at every fix. */
export function usePlace() {
  const fix = useFix();
  const ref = useRef(/** @type {{lat:number, lon:number}|null} */ (null));
  if (fix && (!ref.current || distM(ref.current.lat, ref.current.lon, fix.lat, fix.lon) > MOVE_M)) {
    ref.current = { lat: fix.lat, lon: fix.lon };
  }
  return ref.current;
}

/** "oggi 10:42" or "3 ott". */
export function whenLabel(ts, now) {
  return format.dayKey(ts) === format.dayKey(now)
    ? `${t('core.fmt.today')} ${format.time(ts)}` : format.dateShort(ts);
}

/** "Trovato chiuso" · "Trovato aperto" (SPEC 6.10). @param {{note:import('../../../core/types.js').Note}} p */
export function VisitButtons({ note }) {
  const stamp = useAction((open) => stampVisit(note.id, open));
  return html`<div class="btn-row">
    <${Button} variant="secondary" icon="door-closed" label=${t('core.visit.closed')} busy=${stamp.busy}
      onClick=${() => stamp.run(false)} />
    <${Button} variant="secondary" icon="check" label=${t('core.visit.open')} busy=${stamp.busy}
      onClick=${() => stamp.run(true)} />
  </div>`;
}

/**
 * One note as a row. `near` = the "Cosa so di qui" flavour (thumbnail, stamp line, stamp buttons).
 * @param {{note:import('../../../core/types.js').Note, distM:number|null, now:number, near?:boolean,
 *   stamps?:boolean}} props
 */
export function NoteRow({ note, distM: dist, now, near, stamps }) {
  const c = category(note.cat);
  const label = t(catLabelKey(note.cat));
  const text = note.text.split('\n')[0].trim();
  const active = isScheduleActive(note.schedule, new Date(now));
  const visits = visitInfo(note, now, t);
  const tags = [];
  if (visits.closedNow) tags.push({ label: t('core.visit.oftenClosed'), tone: 'warning' });
  if (note.private) tags.push({ label: t('core.tag.private'), icon: 'lock' });
  if (note.origin === 'received') tags.push({ label: t('core.tag.received') });
  if (note.schedule) tags.push({ label: t('note.tag.timed'), icon: 'clock' });
  let sub = text ? label : '';
  if (!active) sub = t('core.alert.notNow', { when: format.scheduleLabel(note.schedule).toLowerCase() });
  else if (near && visits.lines.length) sub = visits.lines[0];
  const row = html`<${ListRow} icon=${c.icon} tone=${c.tone} thumbId=${near && note.photoId ? note.photoId : undefined}
    title=${text || `${label} · ${whenLabel(note.createdAt, now)}`} sub=${sub} tags=${tags} dim=${!active}
    value=${dist === null ? undefined : format.distance(dist)} chevron href=${router.href(`/note/${note.id}`)} />`;
  if (!(stamps && note.biz)) return row;
  return html`<div class="stack">${row}<${VisitButtons} note=${note} /></div>`;
}
