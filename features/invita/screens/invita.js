// @ts-check
// Fai provare a un collega: the app's own address as a QR code, and the plain link share. The
// address is the one the page was opened from (DECISIONS 11), so it is right on any copy of the app.
import { html, useMemo } from '../../../ui/html.js';
import { useLang } from '../../../ui/hooks.js';
import { Screen, Button, toast } from '../../../ui/kit/index.js';
import { t, env, share, clipboard, log } from '../../../core/api.js';
import { encodeQr, qrPath } from '../logic/qr.js';

/** The drawing of the code, or null when the address does not fit one (over 213 bytes). */
function drawing(url) {
  try {
    return qrPath(encodeQr(url));
  } catch (err) {
    log.warn('invita', 'qr-failed');
    return null;
  }
}

export default function InvitaScreen() {
  useLang();
  const url = env.appUrl();
  const qr = useMemo(() => drawing(url), [url]);

  const send = () => {
    const text = t('ui.share.text');
    // First statement of the click: the share sheet needs the user activation.
    share.shareText({ text, url }).then((res) => {
      if (res === 'sandbox') toast(t('core.nav.sandbox'));
      else if (res === 'unsupported') {
        return clipboard.copyText(`${text} ${url}`).then((ok) => toast(
          t(ok ? 'core.action.copied' : 'invita.copyFailed'), { icon: ok ? 'check' : 'triangle-alert' },
        ));
      }
      return undefined;
    }).catch((err) => log.error('invita', err));
  };
  const copy = () => {
    clipboard.copyText(url).then((ok) => toast(
      t(ok ? 'core.action.copied' : 'invita.copyFailed'), { icon: ok ? 'check' : 'triangle-alert' },
    ));
  };

  return html`<${Screen} title=${t('invita.title')} icon="share-2" back="/altro">
    <div class="f-invita">
      <p class="t-body-m">${t(qr ? 'invita.scan' : 'invita.noQr')}</p>
      ${qr && html`<div class="f-invita-qr">
        <svg viewBox=${`0 0 ${qr.box} ${qr.box}`} role="img" aria-label=${t('invita.qrAlt')}
          shape-rendering="crispEdges" focusable="false">
          <path d=${qr.d} fill="currentColor" />
        </svg>
      </div>`}
      <p class="t-caption t-muted f-invita-url">${url}</p>
      <div class="f-invita-actions">
        <${Button} variant="primary" size="xl" block icon="share-2" label=${t('invita.send')} onClick=${send} />
        <${Button} variant="secondary" block icon="copy" label=${t('invita.copy')} onClick=${copy} />
      </div>
      <p class="t-caption t-muted">${t('invita.note')}</p>
    </div>
  <//>`;
}
