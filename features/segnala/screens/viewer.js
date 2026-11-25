// @ts-check
// Viewer of a shared link (#a=1.…): no onboarding, no permission prompt, no tile before the tap.
import { html, useState, useMemo } from '../../../ui/html.js';
import { useAction, useTick, useLang, useStore } from '../../../ui/hooks.js';
import { Screen, Card, Button, LinkButton, MapView, NavigateSheet, Empty, toast } from '../../../ui/kit/index.js';
import { t, clock, env, format, settings, clipboard, router } from '../../../core/api.js';
import { alertType, alertTypeKey } from '../../../core/pure/catalog.js';
import { decodeAlert } from '../logic/alert-link.js';

export default function ViewerScreen({ params }) {
  useLang();
  const now = useTick(60000);
  const primary = useStore((s) => s.primary);
  const fragment = String(params?.fragment ?? '');
  const decoded = useMemo(() => decodeAlert(fragment, clock.now()), [fragment]);
  const [mapOpen, setMapOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const hasProfile = Boolean(settings.get('onboardedAt'));

  const add = useAction(async () => {
    const { addFromText } = await import('./segnala.js');
    await addFromText(fragment);
  });
  const copy = useAction(async () => {
    const ok = await clipboard.copyText(`${env.appUrl()}#${fragment}`);
    toast(t(ok ? 'segnala.viewer.copied' : 'segnala.send.noCopy'), { icon: ok ? 'check' : 'triangle-alert' });
  });
  const footer = html`<footer class="stack">
    <${Button} variant="ghost" block icon="info" label=${t('segnala.viewer.what')}
      onClick=${() => router.navigate(hasProfile ? '/' : '/benvenuto')} />
    <p class="t-caption t-muted t-center">
      <a href=${router.href('/legale/privacy')}>${t('segnala.viewer.privacy')}</a>
      ${' · '}
      <a href=${router.href('/legale/termini')}>${t('segnala.viewer.terms')}</a>
    </p>
  </footer>`;

  if (!decoded.ok) {
    const title = decoded.reason === 'expired' && decoded.expiresAt
      ? t('segnala.viewer.expired', { time: format.time(decoded.expiresAt) }) : t('segnala.viewer.invalid');
    return html`<${Screen} title=${t('segnala.viewer')} banner=${false}>
      <div class="stack stack--lg">
        <${Empty} icon=${decoded.reason === 'expired' ? 'clock' : 'triangle-alert'} title=${title} />
        ${footer}
      </div>
    <//>`;
  }

  const a = decoded.alert;
  const type = alertType(a.type);
  const label = t(alertTypeKey(a.type));
  const expired = a.expiresAt < now;
  const pin = [{ id: a.id, lat: a.lat, lon: a.lon, tone: type.tone, icon: type.icon, label }];
  return html`<${Screen} title=${t('segnala.viewer')} banner=${false}>
    <div class="stack stack--lg">
      <${Card} tone=${type.tone} icon=${type.icon} title=${label}>
        <p class="t-body-m">${expired
          ? t('segnala.viewer.expired', { time: format.time(a.expiresAt) })
          : t('segnala.viewer.when', { ago: format.ago(a.createdAt, now), time: format.time(a.expiresAt) })}</p>
        ${a.text && html`<p class="t-title-l">${a.text}</p>`}
        <p class="t-caption t-muted">${t('core.alert.received')}</p>
      <//>
      ${mapOpen
        ? html`<${MapView} center=${{ lat: a.lat, lon: a.lon }} zoom=${15} pins=${pin}
            fallback=${html`<p class="t-body-m">${format.coords(a.lat, a.lon)}</p>`} />`
        : html`<div class="stack">
            <${Button} variant="secondary" block icon="map" label=${t('segnala.viewer.showMap')}
              onClick=${() => setMapOpen(true)} />
            ${!hasProfile && html`<p class="t-caption t-muted">${t('segnala.legal.viewerMap')}</p>`}
          </div>`}
      <${Button} variant="secondary" block icon="navigation" label=${t('core.action.takeMe')}
        onClick=${() => setNavOpen(true)} />
      ${!expired && hasProfile && primary && !env.isIosTab() && html`<${Button} size="xl" block icon="map-pin-plus"
        label=${t('segnala.viewer.add')} busy=${add.busy} onClick=${add.run} />`}
      ${!expired && (env.isIosTab() || (hasProfile && !primary)) && html`<div class="stack">
        <${Button} size="xl" block icon="copy" label=${t('segnala.viewer.copy')} onClick=${copy.run} />
        <p class="t-caption t-muted">${t('segnala.viewer.copyHelp')}</p>
      </div>`}
      ${hasProfile && primary && html`<${LinkButton} variant="ghost" block href=${router.href('/segnala')}
        label=${t('segnala.title')} />`}
      ${footer}
    </div>
    <${NavigateSheet} open=${navOpen} dest=${{ lat: a.lat, lon: a.lon, label }} onClose=${() => setNavOpen(false)} />
  <//>`;
}
