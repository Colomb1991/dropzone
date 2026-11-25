// @ts-check
// Segnala: six type tiles, the active alerts, and the paste bridge for iPhone.
import { html, useState } from '../../../ui/html.js';
import { useLive, useAction, useTick, useLang } from '../../../ui/hooks.js';
import {
  Screen, Tiles, Tile, List, ListRow, Button, LinkButton, Field, Empty, Sheet, toast,
} from '../../../ui/kit/index.js';
import { t, clock, geo, store, speech, cues, format, clipboard, handoff, AppError } from '../../../core/api.js';
import { ALERT_TYPES, alertType, alertTypeKey } from '../../../core/pure/catalog.js';
import { decodeAlert, extractAlertFragment } from '../logic/alert-link.js';
import {
  listActive, createAlert, addReceived, removeAlert, takeCaptured, freshFix, FRESH_FIX_MS,
} from '../alerts.js';
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

/**
 * "La mappa è sbagliata?": a wrong one-way, a closed road, a missing house number. The app sends
 * nothing: it opens OpenStreetMap's note form on the point, where volunteers check and fix the map.
 * @param {{point:{lat:number, lon:number}|null, onClose:()=>void}} props
 */
function MapErrorSheet({ point, onClose }) {
  return html`<${Sheet} open=${Boolean(point)} title=${t('segnala.map.title')} onClose=${onClose}>
    ${point && html`<div class="stack">
      <p class="t-body-m">${t('segnala.map.how')}</p>
      <p class="t-body-m t-muted">${t('segnala.map.when')}</p>
      <p class="t-caption t-muted">${t('segnala.legal.osmNote')}</p>
      <${LinkButton} size="xl" block external icon="external-link" label=${t('segnala.map.open')}
        href=${handoff.osmNoteUrl(point.lat, point.lon)} onClick=${onClose} />
    </div>`}
  <//>`;
}

export default function SegnalaScreen() {
  useLang();
  const now = useTick(60000);
  const { data: alerts } = useLive(['alerts'], () => listActive(), []);
  const [sending, setSending] = useState(/** @type {any} */ (null));
  const [mapPoint, setMapPoint] = useState(/** @type {{lat:number, lon:number}|null} */ (null));
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState('');

  const create = useAction(async (type) => {
    const at = clock.now();
    // Never an old fix: the alert tells colleagues where the problem is.
    const pos = takeCaptured() ?? freshFix(at) ?? await geo.currentPosition({ maxAgeMs: FRESH_FIX_MS });
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
  const mapError = useAction(async () => {
    // The same rule as an alert: the note must land where the courier is now.
    const pos = freshFix(clock.now()) ?? await geo.currentPosition({ maxAgeMs: FRESH_FIX_MS });
    if (!pos) throw new AppError('no-position', 'segnala.err.noPosition');
    setMapPoint({ lat: pos.lat, lon: pos.lon });
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
      <section class="stack">
        <h2 class="t-title-m">${t('segnala.map.section')}</h2>
        <p class="t-body-m t-muted">${t('segnala.map.hint')}</p>
        <${Button} variant="secondary" block icon="map" label=${t('segnala.map.button')} busy=${mapError.busy}
          onClick=${mapError.run} />
      </section>
    </div>
    <${SendSheet} alert=${sending} onClose=${() => setSending(null)} />
    <${MapErrorSheet} point=${mapPoint} onClose=${() => setMapPoint(null)} />
  <//>`;
}
