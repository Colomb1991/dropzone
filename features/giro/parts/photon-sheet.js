// @ts-check
// The one-time explanation before the first online address search. The service stays off until the
// courier says yes here or in Settings.
import { html } from '../../../ui/html.js';
import { t, settings, log } from '../../../core/api.js';
import { Sheet, Button, toast } from '../../../ui/kit/index.js';

const save = (key, value) => settings.set(key, value).catch((err) => log.error('giro', err));

/** @param {{open:boolean, onClose:(turnedOn:boolean)=>void}} props */
export function PhotonSheet({ open, onClose }) {
  const answer = (on) => () => {
    save('giro.photonAsked', true);
    if (on) {
      save('svc.photon', true);
      toast(t('giro.photon.enabled'), { icon: 'check' });
    }
    onClose(on);
  };
  // Closed by fast driving: nothing was answered, so the sheet comes back at the next search.
  const close = (why) => (why === 'moving' ? onClose(false) : answer(false)());
  const footer = html`
    <${Button} block size="xl" icon="search" label=${t('giro.photon.on')} onClick=${answer(true)} />
    <${Button} block variant="ghost" label=${t('giro.photon.notNow')} onClick=${answer(false)} />`;
  return html`<${Sheet} open=${open} title=${t('giro.photon.title')} onClose=${close} footer=${footer}>
    <p class="t-body-m">${t('giro.photon.text')}</p>
    <p class="t-body-m t-muted">${t('giro.photon.more')}</p>
  <//>`;
}
