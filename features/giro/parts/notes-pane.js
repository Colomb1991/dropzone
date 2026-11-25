// @ts-check
// A saved note becomes a stop: the courier's own point, at the place they marked.
import { html, useState, useMemo } from '../../../ui/html.js';
import { t, notes, format } from '../../../core/api.js';
import { useLive } from '../../../ui/hooks.js';
import { List, ListRow, Button, Empty, Icon } from '../../../ui/kit/index.js';
import { category, catLabelKey } from '../../../core/pure/catalog.js';
import { distM } from '../../../core/pure/geo-math.js';
import { pendingStops } from '../logic/route.js';
import { noteLine } from './common.js';

const PAGE = 40;
const SAME_PLACE_M = 15;

/**
 * @param {{route:import('../logic/route.js').Route|undefined, here:{lat:number, lon:number}|null,
 *   onAdd:(input:object)=>void, busy:boolean}} props
 */
export function NotesPane({ route, here, onAdd, busy }) {
  const { data, loading } = useLive(['notes'], () => notes.listNotes());
  const [limit, setLimit] = useState(PAGE);
  const rows = useMemo(() => {
    const list = (data ?? []).map((note) => ({ note, d: here ? distM(here.lat, here.lon, note.lat, note.lon) : null }));
    // Nearest first with a position, most recent first without.
    return list.sort((a, b) => (here ? a.d - b.d : b.note.updatedAt - a.note.updatedAt));
  }, [data, here]);
  const waiting = route ? pendingStops(route) : [];
  const inRoute = (n) => waiting.some((s) => distM(s.lat, s.lon, n.lat, n.lon) <= SAME_PLACE_M);

  if (!loading && rows.length === 0) {
    return html`<${Empty} icon="map-pin" title=${t('giro.notes.empty')} text=${t('giro.notes.emptyText')} />`;
  }
  return html`<div class="stack">
    <p class="t-body-m t-muted">${t('giro.notes.help')}</p>
    ${loading && html`<p class="t-body-m t-muted" role="status">${t('core.state.loading')}</p>`}
    <${List} label=${t('giro.mode.notes')}>
      ${rows.slice(0, limit).map(({ note, d }) => {
        const c = category(note.cat);
        const added = inRoute(note);
        const sub = [t(catLabelKey(note.cat)), d === null ? '' : format.distance(d)].filter(Boolean).join(' · ');
        return html`<${ListRow} key=${note.id} icon=${c.icon} tone=${c.tone} title=${noteLine(note)} sub=${sub}
          tags=${added ? [{ label: t('giro.notes.inRoute'), tone: 'success', icon: 'check' }] : undefined}
          disabled=${busy || added} dim=${added}
          trailing=${!added && html`<${Icon} name="plus" label=${t('giro.add.short')} />`}
          onClick=${() => onAdd({ lat: note.lat, lon: note.lon, label: noteLine(note), src: 'note', addr: null })} />`;
      })}
    <//>
    ${rows.length > limit && html`<${Button} variant="secondary" block label=${t('core.action.showMore')}
      onClick=${() => setLimit(limit + PAGE)} />`}
  </div>`;
}
