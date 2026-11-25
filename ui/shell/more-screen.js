// @ts-check
// "Altro": rows contributed by the features (nav place 'more') merged with the shell's own rows,
// in the order of SPEC 2.3.
import { html } from '../html.js';
import * as router from '../../core/router.js';
import * as session from '../../core/shift/session.js';
import * as swClient from '../../core/sw-client.js';
import { APP_VERSION } from '../../config/app.js';
import { t } from '../../core/i18n.js';
import { updateAction } from '../../core/pure/update-policy.js';
import { useStore } from '../hooks.js';
import { Screen } from '../kit/screen.js';
import { List, ListRow } from '../kit/row.js';
import { sectionAccent } from '../kit/accent.js';
import { Toggle } from '../kit/toggle.js';
import { confirm } from '../kit/dialog.js';
import { moreItems } from './registry-view.js';

const ORDER = { passenger: 50, share: 60, update: 80 };
/** "Fai provare a un collega": the screen of feature `invita` (QR code and link share). */
const INVITE_PATH = '/invita';

async function togglePassenger(on) {
  if (!on) {
    session.setPassenger(false);
    return;
  }
  const ok = await confirm({ icon: 'info', title: t('ui.more.passenger'), text: t('ui.more.passengerText'),
    confirm: t('ui.more.passenger'), cancel: t('core.action.cancel') });
  if (ok) session.setPassenger(true);
}

export default function MoreScreen() {
  const shift = useStore((s) => s.shift);
  const moving = useStore((s) => s.moving);
  const passenger = useStore((s) => s.passenger);
  const updateReady = useStore((s) => s.updateReady);
  const primary = useStore((s) => s.primary);

  const rows = moreItems().map((n) => ({
    order: n.order,
    node: html`<${ListRow} icon=${n.icon} tone=${n.tone} accent=${sectionAccent(n.featureId)} title=${t(n.labelKey)}
      href=${router.href(n.to)} chevron
      tags=${n.beta ? [{ label: t('ui.tag.beta'), icon: 'flask-conical' }] : undefined} />`,
  }));
  if (shift && shift.mode === 'holder' && (!moving || passenger)) {
    rows.push({ order: ORDER.passenger, node: html`<${Toggle} label=${t('ui.more.passenger')}
      sub=${t('ui.more.passengerSub')} checked=${passenger} onChange=${togglePassenger} />` });
  }
  rows.push({ order: ORDER.share, node: html`<${ListRow} icon="share-2" accent=${sectionAccent('invita')}
    title=${t('core.nav.shareApp')} sub=${t('ui.share.sub')} href=${router.href(INVITE_PATH)} chevron />` });
  if (updateReady) {
    // Same rule as the banner "Nuova versione pronta.": also during a shift, never while moving.
    const blocked = updateAction({ waiting: true, primary, moving }) !== 'offer';
    rows.push({ order: ORDER.update, node: html`<${ListRow} icon="download" tone="info" title=${t('core.nav.updateApp')}
      sub=${blocked ? t('ui.more.updateLater') : t('core.update.ready')} disabled=${blocked}
      onClick=${() => swClient.applyUpdate()} />` });
  }
  rows.sort((a, b) => a.order - b.order);

  return html`<${Screen} title=${t('core.nav.more')}>
    <div class="more__brand">
      <p class="more__name">${t('core.app.name')}</p>
      <p class="more__tagline">${t('core.app.tagline')}</p>
    </div>
    <${List}>${rows.map((r) => r.node)}<//>
    <p class="more__version num">${t('ui.more.version', { v: APP_VERSION })}</p>
  <//>`;
}
