// @ts-check
// Slot home.shift (order 50): the card "Cosa so di qui". On the shift home every pixel of height
// counts (SPEC T1-10): "Vedi tutte (n)" sits in the card title instead of under the rows.
import { html, useState } from '../../../ui/html.js';
import { t } from '../../../core/api.js';
import { useLang } from '../../../ui/hooks.js';
import { Card } from '../../../ui/kit/index.js';
import { useNearbyNotes, NearbyRows, NEARBY_SHOWN } from '../components/nearby.js';

export default function NearbyShift() {
  useLang();
  const { rows } = useNearbyNotes();
  const [all, setAll] = useState(false);
  const more = rows.length > NEARBY_SHOWN
    ? { label: t('note.here.all', { n: rows.length }), onClick: () => setAll(true) } : undefined;
  return html`<${Card} icon="map-pin" title=${t('note.here.title')} action=${more}>
    <${NearbyRows} rows=${rows} all=${all} onAll=${setAll} compact />
  <//>`;
}
