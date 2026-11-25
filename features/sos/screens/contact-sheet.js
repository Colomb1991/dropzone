// @ts-check
import { html, useState } from '../../../ui/html.js';
import { useAction } from '../../../ui/hooks.js';
import { Sheet, Button, Field, Chips, Chip, toast } from '../../../ui/kit/index.js';
import { t, settings, format } from '../../../core/api.js';
import { normalizePhone } from '../../../core/pure/validators.js';

const NAME_MAX = 20;

/**
 * Trusted contact: name, number (stored as E.164), channel.
 * @param {{contact:{name:string, number:string, channel:'whatsapp'|'sms'}|null, onClose:()=>void}} props
 */
export function ContactSheet({ contact, onClose }) {
  const [name, setName] = useState(contact?.name ?? '');
  const [number, setNumber] = useState(contact ? format.phone(contact.number) : '');
  const [channel, setChannel] = useState(contact?.channel ?? 'whatsapp');
  const e164 = normalizePhone(number);
  const ready = name.trim().length > 0 && e164 !== null;

  const save = useAction(async () => {
    await settings.set('sos.contact', { name: name.trim().slice(0, NAME_MAX), number: e164, channel });
    toast(t('sos.contact.saved'), { icon: 'check' });
    onClose();
  });
  const remove = useAction(async () => {
    await settings.set('sos.contact', null);
    toast(t('sos.contact.removed'));
    onClose();
  });

  const footer = html`<div class="stack">
    <${Button} block label=${t('core.action.save')} disabled=${!ready} busy=${save.busy} onClick=${save.run} />
    ${contact && html`<${Button} block variant="ghost" icon="trash-2" label=${t('sos.contact.remove')}
      onClick=${remove.run} />`}
  </div>`;
  return html`<${Sheet} open title=${t('sos.contact.title')} onClose=${onClose} footer=${footer}>
    <div class="stack">
      <${Field} label=${t('sos.contact.name')} value=${name} max=${NAME_MAX} onInput=${setName} autocomplete="off" />
      <${Field} label=${t('sos.contact.number')} type="tel" inputmode="tel" value=${number} onInput=${setNumber}
        helper=${e164 ? t('sos.contact.shown', { number: format.phone(e164) }) : undefined}
        error=${number.trim() !== '' && !e164 ? t('sos.contact.bad') : undefined} />
      <${Chips} label=${t('sos.contact.channel')}>
        ${['whatsapp', 'sms'].map((c) => html`<${Chip} label=${t(`sos.contact.${c}`)} pressed=${channel === c}
          onToggle=${() => setChannel(c)} />`)}
      <//>
      <p class="t-caption t-muted">${t('sos.contact.notice')}</p>
    </div>
  <//>`;
}
