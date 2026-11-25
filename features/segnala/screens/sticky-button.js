// @ts-check
// Slot home.sticky: "Segnala" captures position and time, then opens the type tiles.
import { html } from '../../../ui/html.js';
import { Button } from '../../../ui/kit/index.js';
import { t, clock, router } from '../../../core/api.js';
import { setCaptured, freshFix } from '../alerts.js';

export default function SegnalaButton() {
  const open = () => {
    const fix = freshFix();
    setCaptured(fix ? { lat: fix.lat, lon: fix.lon, at: clock.now() } : null);
    router.navigate('/segnala');
  };
  return html`<${Button} variant="secondary" size="xl" block icon="megaphone" label=${t('segnala.sticky')}
    onClick=${open} />`;
}
