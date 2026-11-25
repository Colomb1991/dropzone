// @ts-check
import { html, useEffect, useState } from '../../../ui/html.js';
import { useSetting, useTick, useLang, useAction, useStore } from '../../../ui/hooks.js';
import { Screen, Button, LinkButton, List, ListRow, toast } from '../../../ui/kit/index.js';
import { t, geo, handoff, share, format } from '../../../core/api.js';
import { sosMessage, contactLink, betterFix, usableFix } from '../logic/message.js';
import { validateQuick } from '../logic/quick.js';
import { ContactSheet } from './contact-sheet.js';
import { QuickSheet } from '../parts/quick-sheet.js';
import { IncidentSheet } from '../parts/incident-sheet.js';

const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/** Best position known, improved while the screen is open. */
function useBestFix() {
  const [fix, setFix] = useState(() => geo.lastFix());
  const [searching, setSearching] = useState(true);
  useEffect(() => {
    let alive = true;
    const take = (f) => {
      if (alive && f) setFix((cur) => betterFix(cur, f));
    };
    const off = geo.onFix(take);
    // A quick answer first (may be a minute old), then a fresh one: the link follows the better fix.
    geo.currentPosition({ maxAgeMs: 60000 }).then((f) => {
      take(f);
      if (alive) setSearching(false);
      return geo.currentPosition({ maxAgeMs: 0, timeoutMs: 15000 });
    }).then(take);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return { fix, searching };
}

export default function SosScreen() {
  useLang();
  const now = useTick(5000);
  const [contact] = useSetting('sos.contact');
  const [editing, setEditing] = useState(false);
  const [quick] = useSetting('sos.quick');
  const [sheet, setSheet] = useState(/** @type {null|'quick'|'incident'} */ (null));
  // Ticks of the accident card: kept while the screen is open, never stored.
  const [steps, setSteps] = useState(/** @type {number[]} */ ([]));
  // 112 and the position message work while moving; a call to the depot waits for a stop.
  const locked = useStore((s) => s.moving && !s.passenger);
  const numbers = validateQuick(quick) ? quick : [];
  const best = useBestFix();
  const fix = usableFix(best.fix, now);

  const text = sosMessage(fix, { withFix: t('sos.msg.fix'), noFix: t('sos.msg.noFix'), time: format.time,
    mapUrl: handoff.mapPointUrl });
  const link = contactLink(contact, text, handoff);
  // The share sheet needs the tap's activation: nothing is awaited before it.
  const send = useAction(() => share.shareText({ text }).then((res) => {
    if (res === 'unsupported') toast(t('core.err.generic'), { icon: 'triangle-alert' });
  }));

  let caption = t('sos.pos.none');
  if (fix) caption = t('sos.pos.caption', { age: format.ago(fix.ts, now), acc: format.accuracy(fix.acc) });
  else if (best.searching) caption = t('sos.pos.searching');

  let sendButton;
  if (contact && link) {
    sendButton = html`<${LinkButton} variant="primary" size="xl" block icon="message-circle"
      label=${t('sos.sendTo', { name: contact.name })} href=${link} external=${contact.channel !== 'sms'} />`;
  } else if (canShare()) {
    sendButton = html`<${Button} variant="primary" size="xl" block icon="share-2" label=${t('sos.send')}
      onClick=${send.run} />`;
  } else {
    sendButton = html`<${LinkButton} variant="primary" size="xl" block icon="message-circle" label=${t('sos.send')}
      href=${handoff.whatsappUrl(text)} external />`;
  }

  return html`<${Screen} title=${t('sos.title')}>
    <div class="stack stack--lg">
      <${LinkButton} variant="danger" size="xl" block icon="phone" label=${t('sos.call')}
        href=${handoff.telUrl('112')} />
      <div class="stack">
        ${sendButton}
        <p class="t-caption t-muted" role="status">${caption}</p>
      </div>
      <p class="t-caption t-muted">${t('sos.disclaimer')}</p>
      <section class="f-sos-section">
        <h2 class="section-title">${t('sos.quick.title')}</h2>
        ${numbers.length > 0
          ? html`<${List} label=${t('sos.quick.title')}>
              ${numbers.map((q) => html`<${ListRow} key=${`${q.number} ${q.name}`} icon="phone" tone="info"
                title=${q.name} sub=${format.phone(q.number)} href=${handoff.telUrl(q.number)}
                disabled=${locked} dim=${locked} />`)}
            <//>`
          : html`<p class="t-body-m t-muted">${t('sos.quick.hint')}</p>`}
        <${Button} variant="secondary" icon=${numbers.length > 0 ? 'pencil' : 'plus'}
          label=${t(numbers.length > 0 ? 'sos.quick.edit' : 'sos.quick.add')} onClick=${() => setSheet('quick')} />
      </section>
      <div class="f-sos-steps">
        <${List}>
          <${ListRow} icon="clipboard-list" tone="warning" title=${t('sos.incident.title')}
            sub=${t('sos.incident.rowSub')} chevron onClick=${() => setSheet('incident')} />
          ${contact
            ? html`<${ListRow} icon="user" title=${t('sos.contact.current', { name: contact.name })}
                sub=${`${format.phone(contact.number)} · ${t(`sos.contact.${contact.channel}`)}`} chevron
                onClick=${() => setEditing(true)} />`
            : html`<${ListRow} icon="user" title=${t('sos.contact.choose')} sub=${t('sos.contact.chooseSub')} chevron
                onClick=${() => setEditing(true)} />`}
        <//>
      </div>
    </div>
    ${editing && html`<${ContactSheet} contact=${contact} onClose=${() => setEditing(false)} />`}
    ${sheet === 'quick' && html`<${QuickSheet} numbers=${numbers} onClose=${() => setSheet(null)} />`}
    ${sheet === 'incident' && html`<${IncidentSheet} done=${steps} onChange=${setSteps}
      onClose=${() => setSheet(null)} />`}
  <//>`;
}
