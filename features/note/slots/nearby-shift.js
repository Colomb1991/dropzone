// @ts-check
// Slot home.shift (order 50): the card "Cosa so di qui".
import { html } from '../../../ui/html.js';
import { t } from '../../../core/api.js';
import { useLang } from '../../../ui/hooks.js';
import { Card } from '../../../ui/kit/index.js';
import { useNearbyNotes, NearbyRows } from '../components/nearby.js';

export default function NearbyShift() {
  useLang();
  const { rows } = useNearbyNotes();
  return html`<${Card} icon="map-pin" title=${t('note.here.title')}><${NearbyRows} rows=${rows} /><//>`;
}
