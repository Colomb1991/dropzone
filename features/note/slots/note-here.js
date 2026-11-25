// @ts-check
// Slot home.sticky (order 10): the 72 px "Nota qui"; for 8 s after a save, "Scrivi" and "Foto".
import { html } from '../../../ui/html.js';
import { t } from '../../../core/api.js';
import { useLang } from '../../../ui/hooks.js';
import { Button } from '../../../ui/kit/index.js';
import { useCapture } from '../components/capture.js';

export default function NoteHere() {
  useLang();
  const capture = useCapture();
  // Not disabled while moving: the shell locks the page and pulses the banner on a tap.
  return html`
    ${capture.after ? capture.afterBar
      : html`<${Button} block size="xl" icon="map-pin-plus" label=${t('note.capture.here')} busy=${capture.busy}
          onClick=${() => capture.begin()} />`}
    ${capture.node}`;
}
