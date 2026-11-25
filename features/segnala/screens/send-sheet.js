// @ts-check
// "Invia segnalazione": expiry, optional detail, preview, then share / WhatsApp / copy.
import { html, useState, useEffect, useMemo } from '../../../ui/html.js';
import { Sheet, Card, Chips, Chip, Field, Button, LinkButton, toast } from '../../../ui/kit/index.js';
import { t, clock, share, handoff, clipboard, log } from '../../../core/api.js';
import { alertType, alertTypeKey, LIMITS } from '../../../core/pure/catalog.js';
import { hasEnforcementWord, cleanText } from '../../../core/pure/validators.js';
import { EXPIRY_CHOICES, ttlFor } from '../logic/message.js';
import { patchAlert, messageFor } from '../alerts.js';

// Set through the CSSOM (allowed by the CSP): the link has no spaces to break at.
const WRAP = { overflowWrap: 'anywhere', margin: '0' };
const chipLabel =(c) => (c === 'tonight' ? t('segnala.send.tonight') : t(`segnala.send.exp${c}`));

/** @param {{alert: import('../alerts.js').Alert|null, onClose:()=>void}} props */
export function SendSheet({ alert, onClose }) {
  const [text, setText] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [choice, setChoice] = useState(/** @type {number|'tonight'|null} */ (null));
  useEffect(() => {
    setText(alert?.text ?? '');
    setExpiresAt(alert?.expiresAt ?? 0);
    setChoice(null);
  }, [alert?.id]);

  const blocked = hasEnforcementWord(text);
  const draft = useMemo(() => {
    if (!alert || !expiresAt) return null;
    try {
      return messageFor({ ...alert, expiresAt }, blocked ? '' : cleanText(text));
    } catch (err) {
      return null;
    }
  }, [alert, expiresAt, text, blocked]);
  if (!alert) return html`<${Sheet} open=${false} title=${t('segnala.send.title')} onClose=${onClose} />`;

  const type = alertType(alert.type);
  const save = () => patchAlert(alert.id, { expiresAt, text: blocked ? '' : (draft?.fitted ?? '') })
    .catch((err) => log.error('segnala', err));
  const pick = (c) => () => {
    setChoice(c);
    setExpiresAt(alert.createdAt + ttlFor(c, alert.createdAt, clock.now()) * 60000);
  };
  const close = () => {
    if (!blocked) save();
    onClose();
  };
  const send = () => {
    // Share first: it needs the tap's user activation.
    const job = share.shareText({ text: draft?.message ?? '' });
    save();
    job.then((result) => {
      if (result === 'shared') onClose();
      else if (result === 'unsupported') toast(t('segnala.send.noShare'), { icon: 'triangle-alert' });
      else if (result === 'sandbox') toast(t('core.nav.sandbox'));
    });
  };
  const copy = () => {
    const job = clipboard.copyText(draft?.message ?? '');
    save();
    job.then((ok) => toast(t(ok ? 'core.action.copied' : 'segnala.send.noCopy'), { icon: ok ? 'check' : 'triangle-alert' }));
  };
  const ready = Boolean(draft) && !blocked;

  return html`<${Sheet} open title=${t('segnala.send.title')} onClose=${close}>
    <div class="stack">
      <${Card} tone=${type.tone} icon=${type.icon} title=${t(alertTypeKey(alert.type))}>
        <p class="t-body-m">${t('segnala.send.onMap')}</p>
      <//>
      <${Chips} label=${t('segnala.send.expiry')}>
        ${EXPIRY_CHOICES.map((c) => html`<${Chip} label=${chipLabel(c)} pressed=${choice === c} onToggle=${pick(c)} />`)}
      <//>
      <${Field} label=${t('segnala.send.detail')} value=${text} onInput=${setText} max=${LIMITS.alertText}
        error=${blocked ? t('core.err.words') : undefined} />
      ${draft && !blocked && html`<${Card} title=${t('segnala.send.preview')}>
        ${draft.message.split('\n').map((line) => html`<p class="t-body-m" style=${WRAP}>${line}</p>`)}
      <//>`}
      <p class="t-caption t-muted">${t('segnala.legal.beforeShare')}</p>
      <${Button} size="xl" block icon="share-2" label=${t('core.action.send')} disabled=${!ready} onClick=${send} />
      ${ready
        ? html`<${LinkButton} variant="secondary" block external icon="message-circle" label=${t('segnala.send.whatsapp')}
            href=${handoff.whatsappUrl(draft?.message ?? '')} onClick=${save} />`
        : html`<${Button} variant="secondary" block icon="message-circle" label=${t('segnala.send.whatsapp')} disabled />`}
      <${Button} variant="ghost" block icon="copy" label=${t('core.action.copy')} disabled=${!ready} onClick=${copy} />
    </div>
  <//>`;
}
