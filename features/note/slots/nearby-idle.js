// @ts-check
// Slot home.idle (order 50): "Cosa so di qui?" → "Guarda" → one fix → notes within 150 m.
import { html, useState } from '../../../ui/html.js';
import { t, geo, proximity } from '../../../core/api.js';
import { useLang, useAction } from '../../../ui/hooks.js';
import { Card, Button, sectionAccent } from '../../../ui/kit/index.js';
import { useNearbyNotes, NearbyRows } from '../components/nearby.js';

export default function NearbyIdle() {
  useLang();
  const { rows, total } = useNearbyNotes();
  const [state, setState] = useState(/** @type {'idle'|'shown'|'nofix'} */ ('idle'));
  const look = useAction(async () => {
    const fix = await geo.currentPosition({ maxAgeMs: 10000 });
    if (fix) proximity.refreshNearby();
    setState(fix ? 'shown' : 'nofix');
  });
  if (total === 0) return null;
  return html`<${Card} icon="map-pin" accent=${sectionAccent('note')} title=${t('note.here.ask')}>
    ${state === 'shown' && html`<${NearbyRows} rows=${rows} />`}
    ${state === 'nofix' && html`<p class="t-body-m t-muted">${t('note.here.noFix')}</p>`}
    <${Button} variant="secondary" icon="locate-fixed" label=${t('note.here.look')} busy=${look.busy}
      onClick=${look.run} />
  <//>`;
}
