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

/** How many rows the card shows before "Vedi tutte (n)". */
export const NEARBY_SHOWN = SHOWN;

/**
 * Two rows, then "Vedi tutte (n)" in a sheet. Stamp buttons only when stopped.
 * `all` + `onAll`: the caller owns the "Vedi tutte" control (the shift home puts it in the card
 * title, where it costs no height); without them the button sits under the rows.
 * `compact`: the two rows on the card are the short ones (the sheet always shows full rows).
 * @param {{rows:{note:any, distM:number}[], all?:boolean, onAll?:(open:boolean)=>void, compact?:boolean}} props
 */
export function NearbyRows({ rows, all: allProp, onAll, compact }) {
  const now = useTick(60000);
  const moving = useStore((s) => s.moving && !s.passenger);
  const [allOwn, setAllOwn] = useState(false);
  const all = onAll ? allProp === true : allOwn;
  const setAll = onAll ?? setAllOwn;
  if (rows.length === 0) return html`<p class="t-body-m t-muted">${t('note.here.none')}</p>`;
  const row = (short) => (r) => html`<${NoteRow} key=${r.note.id} note=${r.note} distM=${r.distM} now=${now} near
    stamps=${!moving} compact=${short} />`;
  return html`
    <${List} label=${t('note.here.title')}>${rows.slice(0, SHOWN).map(row(compact === true))}<//>
    ${!onAll && rows.length > SHOWN && html`<${Button} variant="ghost" block
      label=${t('note.here.all', { n: rows.length })} onClick=${() => setAll(true)} />`}
    <${Sheet} open=${all} title=${t('note.here.title')} onClose=${() => setAll(false)}>
      ${all && html`<${List} label=${t('note.here.title')}>${rows.map(row(false))}<//>`}
    <//>`;
}
