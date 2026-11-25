// @ts-check
// Segnala: six type tiles, the active alerts, and the paste bridge for iPhone.
import { html, useState } from '../../../ui/html.js';
import { useLive, useAction, useTick, useLang } from '../../../ui/hooks.js';
import { Screen, Tiles, Tile, List, ListRow, Button, Field, Empty, toast } from '../../../ui/kit/index.js';
import { t, clock, geo, store, speech, cues, format, clipboard, AppError } from '../../../core/api.js';
import { ALERT_TYPES, alertType, alertTypeKey } from '../../../core/pure/catalog.js';
import { decodeAlert, extractAlertFragment } from '../logic/alert-link.js';
import { listActive, createAlert, addReceived, removeAlert, takeCaptured } from '../alerts.js';
import { SendSheet } from './send-sheet.js';

/** Adds the alert found in pasted text. Shared with the viewer's "Aggiungi alla mia mappa". */
export async function addFromText(text) {
  const fragment = extractAlertFragment(text);
  const r = fragment ? decodeAlert(fragment, clock.now()) : null;
  if (!r || (!r.ok && r.reason === 'invalid')) throw new AppError('alert-invalid', 'segnala.viewer.invalid');
  if (!r.ok) throw new AppError('alert-expired', 'segnala.paste.expired');
  const result = await addReceived(r.alert);
  toast(t(result === 'added' ? 'segnala.added' : 'segnala.present'), { icon: 'check' });
}

export default function SegnalaScreen() {
  useLang();
  const now = useTick(60000);
  const { data: alerts } = useLive(['alerts'], () => listActive(), []);
  const [sending, setSending] = useState(/** @type {any} */ (null));
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState('');

  const create = useAction(async (type) => {
    const at = clock.now();
    const pos = takeCaptured() ?? geo.lastFix() ?? await geo.currentPosition();
    if (!pos) throw new AppError('no-position', 'segnala.err.noPosition');
    const alert = await createAlert({ type, lat: pos.lat, lon: pos.lon, at });
    cues.playCue('saved');
    if (store.getState().moving) speech.say(t('core.say.alertReady'));
    else setSending(alert);
  });
  const remove = useAction(async (id) => {
    await removeAlert(id);
    toast(t('segnala.removed'));
  });
  const paste = useAction(async () => {
    // Clipboard first: reading needs the tap.
    const text = await clipboard.readText();
    if (text === null || !extractAlertFragment(text)) {
      setPasteOpen(true);
      return;
    }
    await addFromText(text);
  });
  const addPasted = useAction(async () => {
    await addFromText(pasted);
    setPasted('');
    setPasteOpen(false);
  });

  const rows = (alerts ?? []).filter((a) => a.expiresAt > now);
  return html`<${Screen} title=${t('segnala.title')} back="/altro">
    <div class="stack stack--lg">
      <section class="stack">
        <h2 class="t-title-m">${t('segnala.new')}</h2>
        <${Tiles}>
          ${Object.values(ALERT_TYPES).map((type) => html`<${Tile} icon=${type.icon} tone=${type.tone}
            label=${t(alertTypeKey(type.code))} disabled=${create.busy} onClick=${() => create.run(type.code)} />`)}
        <//>
      </section>
      <section class="stack">
        <h2 class="t-title-m">${t('segnala.active')}</h2>
        ${rows.length === 0
          ? html`<${Empty} icon="megaphone" title=${t('segnala.empty')} />`
          : rows.map((a) => html`<div class="stack">
              <${List}>
                <${ListRow} icon=${alertType(a.type).icon} tone=${alertType(a.type).tone}
                  title=${t(alertTypeKey(a.type))}
                  sub=${t('segnala.row.sub', { ago: format.ago(a.createdAt, now), time: format.time(a.expiresAt) })}
                  tags=${a.origin === 'received' ? [{ label: t('segnala.row.received') }] : []} />
              <//>
              ${a.text && html`<p class="t-body-m">${a.text}</p>`}
              <div class="tiles">
                <${Button} variant="secondary" icon="share-2" label=${t('segnala.row.resend')}
                  onClick=${() => setSending(a)} />
                <${Button} variant="ghost" icon="trash-2" label=${t('segnala.row.remove')}
                  onClick=${() => remove.run(a.id)} />
              </div>
            </div>`)}
      </section>
      <section class="stack">
        <${Button} variant="secondary" block icon="download" label=${t('segnala.paste')} busy=${paste.busy}
          onClick=${paste.run} />
        ${pasteOpen && html`
          <${Field} label=${t('segnala.paste.field')} value=${pasted} onInput=${setPasted} />
          <${Button} block label=${t('segnala.paste.add')} disabled=${pasted.trim() === ''} onClick=${addPasted.run} />`}
      </section>
    </div>
    <${SendSheet} alert=${sending} onClose=${() => setSending(null)} />
  <//>`;
}
