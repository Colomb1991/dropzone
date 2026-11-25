// @ts-check
// "Cosa so di qui": notes within 150 m, zero taps, silent (SPEC 2.5, 6.1).
import { html, useState, useEffect, useMemo } from '../../../ui/html.js';
import { t, notes, proximity } from '../../../core/api.js';
import { useLive, useTick, useStore } from '../../../ui/hooks.js';
import { List, Button, Sheet } from '../../../ui/kit/index.js';
import { NoteRow } from './note-row.js';

const SHOWN = 2;

/** Notes around the last fix, nearest first; follows the engine (every 5 s, at once on resume). */
export function useNearbyNotes() {
  const [items, setItems] = useState(() => proximity.nearbyNow());
  useEffect(() => {
    setItems(proximity.nearbyNow());
    return proximity.onNearby((list) => setItems(list));
  }, []);
  const { data } = useLive(['notes'], () => notes.listNotes());
  const rows = useMemo(() => {
    const byId = new Map((data ?? []).map((n) => [n.id, n]));
    return items.filter((i) => i.source === 'note' && byId.has(i.id))
      .map((i) => ({ note: byId.get(i.id), distM: i.distM }));
  }, [items, data]);
  return { rows, total: (data ?? []).length };
}

/** Two rows, then "Vedi tutte (n)" in a sheet. Stamp buttons only when stopped. */
export function NearbyRows({ rows }) {
  const now = useTick(60000);
  const moving = useStore((s) => s.moving && !s.passenger);
  const [all, setAll] = useState(false);
  if (rows.length === 0) return html`<p class="t-body-m t-muted">${t('note.here.none')}</p>`;
  const row = (r) => html`<${NoteRow} key=${r.note.id} note=${r.note} distM=${r.distM} now=${now} near
    stamps=${!moving} />`;
  return html`
    <${List} label=${t('note.here.title')}>${rows.slice(0, SHOWN).map(row)}<//>
    ${rows.length > SHOWN && html`<${Button} variant="ghost" block label=${t('note.here.all', { n: rows.length })}
      onClick=${() => setAll(true)} />`}
    <${Sheet} open=${all} title=${t('note.here.title')} onClose=${() => setAll(false)}>
      ${all && html`<${List} label=${t('note.here.title')}>${rows.map(row)}<//>`}
    <//>`;
}
