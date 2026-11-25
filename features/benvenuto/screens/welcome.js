// @ts-check
// Onboarding (SPEC 4.1): the install gate on iOS in a browser tab, then five screens.
// No permission prompt is raised here.
import { html, useEffect, useRef, useState } from '../../../ui/html.js';
import {
  Screen, Button, LinkButton, Art, Icon, Sheet, Toggle, Chip, Chips, Tag, Banner, confirm,
} from '../../../ui/kit/index.js';
import { useAction, useSetting, useLang, useTick } from '../../../ui/hooks.js';
import {
  t, tRich, config, settings, clock, router, env, db, i18n, cues, speech, install, swClient, log,
} from '../../../core/api.js';
import {
  STEP_COUNT, clampStep, needsGate, iosStepKeys, installAdvice, acceptance,
} from '../logic/onboarding.js';

// Kept for the session, so a detour to the legal pages or the demo comes back to the same step.
let lastStep = 0;

function LangSwitch() {
  const lang = useLang();
  const pick = (l) => () => {
    if (l !== lang) i18n.setLang(l).catch((err) => log.error('benvenuto', err));
  };
  return html`<${Chips} label=${t('benvenuto.lang')}>
    <${Chip} label=${t('benvenuto.lang.it')} pressed=${lang === 'it'} onToggle=${pick('it')} />
    <${Chip} label=${t('benvenuto.lang.en')} pressed=${lang === 'en'} onToggle=${pick('en')} />
  <//>`;
}

/** @param {{items:[string, string][]}} props icon name + sentence */
function Points({ items }) {
  return html`<ul class="f-benv-points">
    ${items.map(([icon, text]) => html`<li>
      <span class="f-benv-disc"><${Icon} name=${icon} /></span><span>${text}</span>
    </li>`)}
  </ul>`;
}

function Numbered({ keys }) {
  return html`<ol class="f-benv-numbered">${keys.map((k) => html`<li><span>${t(k)}</span></li>`)}</ol>`;
}

function ServicesSheet({ onClose }) {
  const [tiles, setTiles] = useSetting('svc.tiles');
  const [overpass, setOverpass] = useSetting('svc.overpass');
  const save = (set) => (v) => set(v).catch((err) => log.error('benvenuto', err));
  return html`<${Sheet} open title=${t('benvenuto.svc.title')} onClose=${onClose}
    footer=${html`<${Button} block label=${t('core.action.done')} onClick=${onClose} />`}>
    <div class="f-benv-card">
      <${Toggle} label=${t('benvenuto.svc.tiles')} checked=${tiles === true} onChange=${save(setTiles)} />
      <p class="t-body-m t-muted">${t('benvenuto.svc.tilesText')}</p>
    </div>
    <div class="f-benv-card">
      <${Toggle} label=${t('benvenuto.svc.overpass')} checked=${overpass === true} onChange=${save(setOverpass)} />
      <p class="t-body-m t-muted">${t('benvenuto.svc.overpassText')}</p>
    </div>
    <p class="t-caption t-muted">${t('benvenuto.svc.footer')}</p>
  <//>`;
}

function SoundTest() {
  const [state, setState] = useState(/** @type {'idle'|'ok'|'novoice'|'nosound'} */ ('idle'));
  const run = () => {
    // Both unlocks start inside the tap: sound and speech need the user activation.
    const audio = cues.unlockAudio();
    speech.unlock();
    audio.then(() => {
      const dur = cues.playCue('saved');
      if (!speech.voiceInfo(i18n.getLang())) {
        setState(dur > 0 ? 'novoice' : 'nosound');
        return;
      }
      setTimeout(() => speech.say(t('core.say.audioOk')), dur * 1000 + 150);
      setState('ok');
    }).catch((err) => log.error('benvenuto', err));
  };
  return html`<div class="f-benv-sound">
    <${Button} block variant="secondary" icon="volume-2" label=${t('benvenuto.s4.sound')} onClick=${run} />
    <div role="status">
      ${state === 'ok' && html`
        <p class="f-benv-said"><${Icon} name="volume-2" /><span>${t('core.say.audioOk')}</span></p>
        <p class="t-caption t-muted">${t('benvenuto.s4.soundHint')}</p>`}
      ${state === 'novoice' && html`<p class="t-caption t-muted">${t('benvenuto.s4.noVoice')}</p>`}
      ${state === 'nosound' && html`<p class="t-caption t-muted">${t('benvenuto.s4.noSound')}</p>`}
    </div>
  </div>`;
}

function Gate() {
  const [help, setHelp] = useState(false);
  const useBrowser = useAction(async () => {
    const ok = await confirm({ icon: 'info', title: t('benvenuto.gate.browserTitle'),
      text: t('benvenuto.gate.browserText'), confirm: t('core.action.continue'),
      cancel: t('benvenuto.gate.browserBack') });
    if (ok) await settings.set('browserUseAccepted', true);
  });
  return html`<${Screen} title=${t('core.app.name')} banner=${false} action=${html`<${LangSwitch} />`}>
    <div class="f-benv-step">
      <div class="f-benv-art"><${Art} name="hero" alt=${t('benvenuto.art.hero')} /></div>
      <h2 class="f-benv-title">${t('benvenuto.gate.title')}</h2>
      ${env.inAppBrowser() && html`<${Banner} tone="warning" icon="triangle-alert"
        text=${t('benvenuto.gate.inApp')} />`}
      <${LinkButton} block size="xl" icon="play" label=${t('benvenuto.gate.demo')} href=${router.href('/demo')} />
      <section class="f-benv-card">
        <h3 class="section-title">${t('benvenuto.gate.steps')}</h3>
        <${Numbered} keys=${iosStepKeys(env.iosVersion())} />
      </section>
      <${Points} items=${[['info', t('benvenuto.gate.note1')], ['triangle-alert', t('benvenuto.gate.note2')]]} />
      <${Button} block variant="ghost" label=${t('benvenuto.gate.help')} onClick=${() => setHelp(true)} />
      <${Button} block variant="ghost" label=${t('benvenuto.gate.browser')} busy=${useBrowser.busy}
        onClick=${() => useBrowser.run()} />
    </div>
    ${help && html`<${Sheet} open title=${t('benvenuto.gate.helpTitle')} onClose=${() => setHelp(false)}
      footer=${html`<${Button} block label=${t('core.action.understood')} onClick=${() => setHelp(false)} />`}>
      <${Points} items=${[['chevron-down', t('benvenuto.gate.helpBottom')], ['chevron-down', t('benvenuto.gate.helpTop')],
        ['ellipsis', t('benvenuto.gate.helpCompact')], ['plus', t('benvenuto.gate.helpThen')]]} />
    <//>`}
  <//>`;
}

function LastStep() {
  const beat = useTick(5000);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let alive = true;
    swClient.offlineReady().then((ok) => alive && setOffline(ok === true),
      () => log.warn('benvenuto', 'offline-check-failed'));
    return () => {
      alive = false;
    };
  }, [beat]);
  const advice = installAdvice({ os: env.os(), standalone: env.isStandalone() });
  const prompt = useAction(async () => {
    await install.promptInstall();
  });
  return html`
    <${Points} items=${[['locate-fixed', t('benvenuto.s5.location')]]} />
    ${advice === 'ios' && html`<section class="f-benv-card">
      <h3 class="section-title">${t('benvenuto.s5.install')}</h3>
      <${Numbered} keys=${iosStepKeys(env.iosVersion())} />
    </section>`}
    ${advice === 'android' && html`<section class="f-benv-card">
      <h3 class="section-title">${t('benvenuto.s5.install')}</h3>
      <p class="f-benv-lead">${t('benvenuto.s5.android')}</p>
      ${install.canPrompt() && html`<${Button} block variant="secondary" icon="download"
        label=${t('benvenuto.s5.installBtn')} busy=${prompt.busy} onClick=${() => prompt.run()} />`}
    </section>`}
    ${offline && html`<div class="cluster"><${Tag} tone="success" icon="check" label=${t('benvenuto.s5.offline')} /></div>`}`;
}

function Steps() {
  const [step, setStepRaw] = useState(() => clampStep(lastStep));
  const [services, setServices] = useState(false);
  const heading = useRef(/** @type {HTMLElement|null} */ (null));
  const mounted = useRef(false);
  const go = (n) => {
    lastStep = clampStep(n);
    setStepRaw(lastStep);
  };
  useEffect(() => {
    // Voices load late on some phones: asking once makes them ready for "Prova suono".
    speech.voiceInfo(i18n.getLang());
  }, []);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  const finish = useAction(async (then, query) => {
    for (const [key, value] of acceptance(clock.now(), config.TERMS_VERSION)) await settings.set(key, value);
    db.requestPersist().catch(() => log.warn('benvenuto', 'persist-failed'));
    lastStep = 0;
    router.navigate(then, { replace: true, query });
  });

  const next = html`<${Button} block size="xl" label=${t('core.action.next')} onClick=${() => go(step + 1)} />`;
  const legalLink = (path) => (text) => html`<a href=${router.href(path)}>${text}</a>`;
  const pages = [
    { art: 'hero', alt: t('benvenuto.art.hero'), title: t('benvenuto.s1.title'), sticky: next,
      body: html`
        <p class="f-benv-lead f-benv-lead--strong">${t('benvenuto.s1.p1')}</p>
        <p class="f-benv-lead">${t('benvenuto.s1.p2')}</p>
        <p class="f-benv-lead t-muted">${t('benvenuto.s1.p3')}</p>` },
    { art: 'privacy', title: t('benvenuto.s2.title'),
      sticky: html`${next}
        <${Button} block variant="ghost" label=${t('benvenuto.s2.services')} onClick=${() => setServices(true)} />`,
      body: html`<${Points} items=${[['lock', t('benvenuto.s2.l1')], ['map', t('benvenuto.s2.l2')],
        ['shield-check', t('benvenuto.s2.l3')]]} />` },
    { art: 'shift', title: t('benvenuto.s3.title'),
      sticky: html`<${Button} block size="xl" icon="check" label=${t('core.action.understood')}
        onClick=${() => go(step + 1)} />`,
      body: html`<${Points} items=${[['volume-2', t('benvenuto.s3.l1')], ['pause', t('benvenuto.s3.l2')],
        ['lock', t('benvenuto.s3.l3')], ['phone', t('benvenuto.s3.l4')],
        ['triangle-alert', t('benvenuto.s3.l5')], ['circle-parking', t('benvenuto.s3.l6')]]} />` },
    { art: 'zone', title: t('benvenuto.s4.title'), sticky: next,
      body: html`
        <${Points} items=${[['bell-ring', t('benvenuto.s4.p1')], ['sun', t('benvenuto.s4.p2')],
          ['map-pin', t('benvenuto.s4.p3')]]} />
        <${SoundTest} />` },
    { art: null, title: t('benvenuto.s5.title'),
      sticky: html`
        <p class="f-benv-accept">${tRich('benvenuto.s5.accept', {
          terms: legalLink('/legale/termini'), privacy: legalLink('/legale/privacy') })}</p>
        <${Button} block size="xl" icon="play" label=${t('benvenuto.s5.start')} busy=${finish.busy}
          onClick=${() => finish.run('/')} />`,
      body: html`
        <${LastStep} />
        <${LinkButton} block variant="ghost" icon="play" label=${t('benvenuto.s5.demo')} href=${router.href('/demo')} />
        <${Button} block variant="ghost" icon="download" label=${t('benvenuto.s5.zone')}
          onClick=${() => finish.run('/zona', { importa: '1' })} />` },
  ];
  const page = pages[step];
  const progress = html`<div class="f-benv-progress">
    ${step > 0 && html`<${Button} variant="ghost" iconOnly icon="arrow-left" label=${t('core.action.back')}
      onClick=${() => go(step - 1)} />`}
    <ol class="f-benv-bars" aria-label=${t('benvenuto.progress', { n: step + 1, total: STEP_COUNT })}>
      ${pages.map((p, i) => html`<li data-on=${String(i <= step)} aria-current=${i === step ? 'step' : null}></li>`)}
    </ol>
  </div>`;

  return html`<${Screen} title=${t('core.app.name')} banner=${false} tags=${progress} sticky=${page.sticky}
    action=${step === 0 ? html`<${LangSwitch} />` : null}>
    <div class="f-benv-step" key=${step}>
      ${page.art && html`<div class="f-benv-art"><${Art} name=${page.art} alt=${page.alt ?? ''} /></div>`}
      <h2 class="f-benv-title" tabindex="-1" ref=${heading}>${page.title}</h2>
      ${page.body}
    </div>
    ${services && html`<${ServicesSheet} onClose=${() => setServices(false)} />`}
  <//>`;
}

export default function Welcome() {
  useLang();
  const [accepted] = useSetting('browserUseAccepted');
  return needsGate({ iosTab: env.isIosTab(), browserUseAccepted: accepted })
    ? html`<${Gate} />` : html`<${Steps} />`;
}
