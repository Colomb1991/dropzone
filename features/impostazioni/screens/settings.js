// @ts-check
// Impostazioni (SPEC 4.12): every change is stored at once.
import { html, useEffect, useState } from '../../../ui/html.js';
import {
  Screen, Button, LinkButton, List, ListRow, Toggle, Chip, Chips, Field, Stepper, Range, toast,
} from '../../../ui/kit/index.js';
import { useSetting, useStore, useLang, useLive } from '../../../ui/hooks.js';
import {
  t, config, clock, format, router, i18n, db, cues, speech, handoff, log,
} from '../../../core/api.js';
import {
  THEMES, RADII, RATES, LEVELS, MODES, BREAKS, DAYS, HOURS, CHANNELS, nextHours, contactFromForm,
} from '../logic/options.js';
import { megabytes } from '../logic/diagnostics.js';
import { put, safe, tileCacheInfo } from '../logic/actions.js';
import WipeFlow from './wipe-flow.js';

function Group({ title, children }) {
  return html`<section class="f-imp-group">
    <h2 class="section-title">${title}</h2>
    <div class="f-imp-card">${children}</div>
  </section>`;
}

/** Chips that work as one choice. `label` is read by screen readers and shown when `showLabel` is set. */
function Choice({ label, showLabel = true, value, options, onPick }) {
  return html`<div class="field">
    ${showLabel && html`<span class="field__label">${label}</span>`}
    <${Chips} label=${label}>
      ${options.map((o) => html`<${Chip} key=${String(o.value)} label=${o.label} pressed=${o.value === value}
        onToggle=${() => onPick(o.value)} />`)}
    <//>
  </div>`;
}

function SoundTest() {
  const [said, setSaid] = useState(false);
  const run = () => {
    const audio = cues.unlockAudio();
    speech.unlock();
    audio.then(() => {
      const dur = cues.playCue('alertInfo');
      cues.haptic('alertInfo');
      if (dur === 0 && cues.audioState() === 'off') toast(t('impostazioni.alerts.soundOff'), { icon: 'volume-x' });
      setTimeout(() => speech.say(t('core.say.audioOk')), dur * 1000 + 150);
      setSaid(true);
    }).catch((err) => log.error('impostazioni', err));
  };
  return html`<div class="stack">
    <${Button} block variant="secondary" icon="volume-2" label=${t('impostazioni.alerts.test')} onClick=${run} />
    ${said && html`<p class="t-caption t-muted" role="status">
      ${t('core.say.audioOk')} ${t('impostazioni.alerts.testHint')}</p>`}
  </div>`;
}

function Contact() {
  const [contact] = useSetting('sos.contact');
  const [name, setName] = useState(contact?.name ?? '');
  const [number, setNumber] = useState(contact ? format.phone(contact.number) : '');
  const [channel, setChannel] = useState(contact?.channel ?? 'whatsapp');
  const draft = contactFromForm(name, number, channel);
  const changed = !contact || !draft || draft.name !== contact.name || draft.number !== contact.number
    || draft.channel !== contact.channel;
  const save = () => {
    if (draft) put('sos.contact', draft).then(() => toast(t('impostazioni.sos.saved'), { icon: 'check' }));
  };
  const remove = () => {
    put('sos.contact', null).then(() => {
      setName('');
      setNumber('');
      toast(t('impostazioni.sos.removed'));
    });
  };
  const text = t('impostazioni.sos.testText');
  return html`
    <p class="t-label">${t('impostazioni.sos.contact')}</p>
    <${Field} label=${t('impostazioni.sos.name')} value=${name} max=${20} autocomplete="off" onInput=${setName} />
    <${Field} label=${t('impostazioni.sos.number')} type="tel" inputmode="tel" value=${number} onInput=${setNumber}
      helper=${draft ? format.phone(draft.number) : undefined}
      error=${number.trim() !== '' && !contactFromForm('x', number, channel) ? t('impostazioni.sos.numberBad') : undefined} />
    <${Choice} label=${t('impostazioni.sos.channel')} value=${channel} onPick=${setChannel}
      options=${CHANNELS.map((c) => ({ value: c, label: t(`impostazioni.sos.${c}`) }))} />
    <${Button} block label=${t('core.action.save')} disabled=${!draft || !changed} onClick=${save} />
    ${contact && html`<div class="btn-row">
      ${contact.channel === 'sms'
        ? html`<${LinkButton} variant="secondary" icon="message-circle" label=${t('impostazioni.sos.test')}
            href=${handoff.smsUrl(contact.number, text)} />`
        : html`<${LinkButton} external variant="secondary" icon="message-circle" label=${t('impostazioni.sos.test')}
            href=${handoff.whatsappUrl(text, contact.number)} />`}
      <${Button} variant="ghost" label=${t('impostazioni.sos.remove')} onClick=${remove} />
    </div>`}
    <p class="t-caption t-muted">${t('impostazioni.sos.notice')}</p>`;
}

function Services() {
  const [tiles] = useSetting('svc.tiles');
  const [overpass] = useSetting('svc.overpass');
  const [photon] = useSetting('svc.photon');
  const [weather] = useSetting('svc.weather');
  const [cache, setCache] = useState({ count: 0, bytes: 0 });
  const refresh = () => tileCacheInfo().then(setCache);
  useEffect(() => {
    refresh();
  }, []);
  const clear = () => db.clearTiles().then(() => {
    toast(t('impostazioni.svc.cleared'), { icon: 'check' });
    return refresh();
  });
  const setTiles = (v) => put('svc.tiles', v).then(() => {
    // Switching the map off also empties what it saved (SPEC 4.12).
    if (!v) return db.clearTiles().then(refresh);
    return undefined;
  });
  return html`
    <${Toggle} label=${t('impostazioni.svc.tiles')} checked=${tiles === true} onChange=${setTiles} />
    <p class="t-body-m t-muted">${t('impostazioni.svc.tilesText')}</p>
    <${Button} block variant="secondary" icon="trash-2" disabled=${cache.count === 0}
      label=${t('impostazioni.svc.clear', { n: format.number(megabytes(cache.bytes), 1) })} onClick=${clear} />
    <hr class="f-imp-rule" />
    <${Toggle} label=${t('impostazioni.svc.overpass')} checked=${overpass === true}
      onChange=${(v) => put('svc.overpass', v)} />
    <p class="t-body-m t-muted">${t('impostazioni.svc.overpassText')}</p>
    <hr class="f-imp-rule" />
    <${Toggle} label=${t('impostazioni.svc.photon')} checked=${photon === true}
      onChange=${(v) => put('svc.photon', v)} />
    <p class="t-body-m t-muted">${t('impostazioni.svc.photonText')}</p>
    <hr class="f-imp-rule" />
    <${Toggle} label=${t('impostazioni.svc.weather')} checked=${weather === true}
      onChange=${(v) => put('svc.weather', v)} />
    <p class="t-body-m t-muted">${t('impostazioni.svc.weatherText')}</p>
    <p class="t-caption t-muted">${t('impostazioni.svc.footer')}</p>`;
}

/** Voices load late on some phones: the answer is asked again a few times after the screen opens. */
function useLocalVoice(lang) {
  const [has, setHas] = useState(() => speech.voiceInfo(lang) !== null);
  useEffect(() => {
    const check = () => setHas(speech.voiceInfo(lang) !== null);
    check();
    const timers = [300, 1000, 3000].map((ms) => setTimeout(check, ms));
    return () => timers.forEach(clearTimeout);
  }, [lang]);
  return has;
}

export default function SettingsScreen() {
  const lang = useLang();
  const shift = useStore((s) => s.shift);
  const [theme] = useSetting('theme');
  const [radius] = useSetting('alert.radiusM');
  const [voiceOn] = useSetting('voice.on');
  const [rate] = useSetting('voice.rate');
  const [level] = useSetting('sound.level');
  const [mode] = useSetting('shift.mode');
  const [hours] = useSetting('contract.weeklyHours');
  const [days] = useSetting('contract.daysPerWeek');
  const [breakPaid] = useSetting('contract.breakPaid');
  const [breakMin] = useSetting('shift.breakMin');
  const [navApp] = useSetting('nav.app');
  const [lastBackupAt] = useSetting('lastBackupAt');
  const [wipe, setWipe] = useState(false);
  const usage = useLive(['media', 'notes'], () => safe(db.storageInfo(), { persisted: null, usage: 0 }));

  const hasVoice = useLocalVoice(lang);
  const setLang = (l) => {
    if (l !== lang) i18n.setLang(l).catch((err) => log.error('impostazioni', err));
  };
  const setVoice = (v) => put('voice.on', v).then(() => speech.refresh());
  const navOptions = [{ value: 'ask', label: t('impostazioni.nav.ask') },
    ...handoff.navApps().map((a) => ({ value: a, label: t(`core.nav.${a}`) }))];
  const hoursText = (n) => (hours === null ? t('impostazioni.shift.unset')
    : t('impostazioni.shift.hoursValue', { n: format.number(n, 1) }));
  const info = usage.data;

  return html`<${Screen} title=${t('impostazioni.title')} back="/altro">
    <div class="f-imp">
      <${Group} title=${t('impostazioni.g.lang')}>
        <${Choice} label=${t('impostazioni.g.lang')} showLabel=${false} value=${lang} onPick=${setLang}
          options=${[{ value: 'it', label: t('impostazioni.lang.it') }, { value: 'en', label: t('impostazioni.lang.en') }]} />
      <//>

      <${Group} title=${t('impostazioni.g.theme')}>
        <${Choice} label=${t('impostazioni.g.theme')} showLabel=${false} value=${theme}
          onPick=${(v) => put('theme', v)}
          options=${THEMES.map((v) => ({ value: v, label: t(`impostazioni.theme.${v}`) }))} />
      <//>

      <${Group} title=${t('impostazioni.g.alerts')}>
        <${Range} label=${t('impostazioni.alerts.radius')} value=${radius} stops=${RADII}
          format=${(n) => t('impostazioni.alerts.radiusValue', { n })} onChange=${(v) => put('alert.radiusM', v)} />
        <${Toggle} label=${t('impostazioni.alerts.voice')} checked=${hasVoice && voiceOn === true}
          disabled=${!hasVoice} reason=${t('impostazioni.alerts.noVoice')} onChange=${setVoice} />
        <${Choice} label=${t('impostazioni.alerts.rate')} value=${rate} onPick=${(v) => put('voice.rate', v)}
          options=${RATES.map(([id, v]) => ({ value: v,
            label: `${t(`impostazioni.alerts.rate.${id}`)} ${format.number(Number(v), 2)}` }))} />
        <${Choice} label=${t('impostazioni.alerts.sound')} value=${level} onPick=${(v) => put('sound.level', v)}
          options=${LEVELS.map((v) => ({ value: v, label: t(`impostazioni.alerts.sound.${v}`) }))} />
        <${SoundTest} />
      <//>

      <${Group} title=${t('impostazioni.g.shift')}>
        <${Choice} label=${t('impostazioni.shift.phone')} value=${mode ?? 'holder'} onPick=${(v) => put('shift.mode', v)}
          options=${MODES.map((v) => ({ value: v, label: t(`impostazioni.shift.${v}`) }))} />
        ${mode === 'pocket' && html`<p class="t-caption t-muted">${t('impostazioni.shift.pocketHint')}</p>`}
        <${Stepper} label=${t('impostazioni.shift.hours')} value=${hours ?? HOURS.first} min=${HOURS.min}
          max=${HOURS.max} step=${HOURS.step} format=${hoursText} lessLabel=${t('impostazioni.less')}
          moreLabel=${t('impostazioni.more')} onChange=${(n) => put('contract.weeklyHours', nextHours(hours, n))} />
        <${Choice} label=${t('impostazioni.shift.days')} value=${days} onPick=${(v) => put('contract.daysPerWeek', v)}
          options=${DAYS.map((v) => ({ value: v, label: String(v) }))} />
        <${Toggle} label=${t('impostazioni.shift.breakPaid')} checked=${breakPaid === true}
          onChange=${(v) => put('contract.breakPaid', v)} />
        <${Choice} label=${t('impostazioni.shift.breakMin')} value=${breakMin} onPick=${(v) => put('shift.breakMin', v)}
          options=${BREAKS.map((v) => ({ value: v, label: t('impostazioni.shift.breakValue', { n: v }) }))} />
      <//>

      <${Group} title=${t('impostazioni.g.nav')}>
        <${Choice} label=${t('impostazioni.g.nav')} showLabel=${false} value=${navApp}
          onPick=${(v) => put('nav.app', v)} options=${navOptions} />
      <//>

      <${Group} title=${t('impostazioni.g.services')}><${Services} /><//>

      <${Group} title=${t('impostazioni.g.sos')}><${Contact} /><//>

      <section class="f-imp-group">
        <h2 class="section-title">${t('impostazioni.g.data')}</h2>
        <${List}>
          <${ListRow} icon="download" tone="info" title=${t('impostazioni.backup')} chevron
            href=${router.href('/impostazioni/backup')}
            sub=${lastBackupAt === null ? t('impostazioni.data.backupNever')
              : t('impostazioni.data.backupLast', { when: format.ago(lastBackupAt, clock.now()) })} />
          <${ListRow} icon="gauge" title=${t('impostazioni.data.space')}
            value=${info ? t('impostazioni.data.spaceValue', { n: format.number(megabytes(info.usage), 1) }) : ''}
            sub=${info && info.persisted !== null
              ? t(info.persisted ? 'impostazioni.data.persistYes' : 'impostazioni.data.persistNo') : undefined} />
          <${ListRow} icon="trash-2" tone="danger" title=${t('impostazioni.data.wipe')} disabled=${Boolean(shift)}
            sub=${shift ? t('impostazioni.data.wipeShift') : t('impostazioni.data.wipeSub')}
            onClick=${() => setWipe(true)} />
        <//>
      </section>

      <section class="f-imp-group">
        <h2 class="section-title">${t('impostazioni.g.info')}</h2>
        <${List}>
          <${ListRow} icon="gauge" title=${t('impostazioni.diagnostica')} chevron
            href=${router.href('/impostazioni/diagnostica')} />
          <${ListRow} icon="info" title=${t('impostazioni.info.version')} value=${config.APP_VERSION} />
          <${ListRow} icon="shield-check" title=${t('impostazioni.info.legal')} chevron
            href=${router.href('/legale/privacy')} />
          <${ListRow} icon="play" title=${t('impostazioni.info.demo')} chevron href=${router.href('/demo')} />
        <//>
        <p class="t-body-m t-muted">${t('impostazioni.info.test')}</p>
        <p class="t-body-m t-muted">${t('impostazioni.info.notAffiliated')}</p>
      </section>
    </div>
    ${wipe && html`<${WipeFlow} onClose=${() => setWipe(false)} />`}
  <//>`;
}
