// @ts-check
// Legal notice 12: shown once after the terms version of this build differs from the accepted one.
// Never during a shift, never over the legal pages themselves (the user is reading them).
import { html } from '../../../ui/html.js';
import { Dialog } from '../../../ui/kit/index.js';
import { useSetting, useStore, useAction } from '../../../ui/hooks.js';
import { t, config, settings, clock, router } from '../../../core/api.js';
import { termsOutdated } from '../logic/docs.js';

/** @param {{route?:{name:string, path:string}}} props */
export default function TermsUpdate({ route }) {
  const [onboardedAt] = useSetting('onboardedAt');
  const [version] = useSetting('termsVersion');
  const shift = useStore((s) => s.shift);
  const sandbox = useStore((s) => s.sandbox);
  const accept = useAction(async () => {
    await settings.set('termsVersion', config.TERMS_VERSION);
    await settings.set('termsAcceptedAt', clock.now());
  });
  const path = route?.path ?? '';
  const reading = path.startsWith('/legale') || path.startsWith('/benvenuto') || route?.name === 'viewer';
  if (!termsOutdated(onboardedAt, version, config.TERMS_VERSION) || shift || sandbox || reading) return null;
  return html`<${Dialog} open icon="info" tone="info" title=${t('legale.update.title')}
    text=${t('legale.update.text')}
    actions=${[
      { label: t('core.action.continue'), variant: 'primary', onClick: accept.run },
      { label: t('legale.update.read'), variant: 'secondary', onClick: () => router.navigate('/legale/termini') },
    ]} />`;
}
