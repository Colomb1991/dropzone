// @ts-check
// Frasi pronte: tap a phrase and the phone says it in Italian. The English meaning stays under
// each phrase, so the screen also works as a card to show at the door.
import { html, useEffect, useState } from '../../../ui/html.js';
import { useLang, useSetting } from '../../../ui/hooks.js';
import { Screen, List, ListRow, Chip, Banner } from '../../../ui/kit/index.js';
import { t, speech, router } from '../../../core/api.js';
import { GROUPS, phrasesOf, speakOptions, speechProblem } from '../logic/phrases.js';

/** Voices load late on some phones: the answer is asked again a few times after the screen opens. */
function useItalianVoice() {
  const [has, setHas] = useState(() => speech.voiceInfo('it') !== null);
  useEffect(() => {
    const check = () => setHas(speech.voiceInfo('it') !== null);
    check();
    const timers = [300, 1000, 3000].map((ms) => setTimeout(check, ms));
    return () => timers.forEach(clearTimeout);
  }, []);
  return has;
}

export default function FrasiScreen() {
  useLang();
  const [voiceOn] = useSetting('voice.on');
  const hasVoice = useItalianVoice();
  const [slow, setSlow] = useState(false);
  const [speaking, setSpeaking] = useState(0);
  // Leaving the screen stops the phrase.
  useEffect(() => () => speech.stop(), []);

  const say = (id) => () => {
    // Inside the tap: a phone lets a page speak only after a touch.
    speech.unlock();
    setSpeaking(id);
    speech.say(t(`frasi.it.${id}`), speakOptions(slow))
      .then(() => setSpeaking((cur) => (cur === id ? 0 : cur)));
  };
  const problem = speechProblem({ voiceOn: voiceOn === true, hasVoice });

  return html`<${Screen} title=${t('frasi.title')} back="/altro">
    <div class="f-frasi">
      <div class="f-frasi-top">
        <p class="t-body-m t-muted">${t('frasi.hint')}</p>
        <${Chip} label=${t('frasi.slow')} pressed=${slow} onToggle=${() => setSlow(!slow)} />
      </div>
      ${problem === 'off' && html`<${Banner} tone="neutral" icon="volume-x" text=${t('frasi.voiceOff')}
        action=${{ label: t('core.action.openSettings'), onClick: () => router.navigate('/impostazioni') }} />`}
      ${problem === 'none' && html`<${Banner} tone="neutral" icon="volume-x" text=${t('frasi.noVoice')} />`}
      ${GROUPS.map((g) => html`
        <h2 class="section-title">${t(`frasi.g.${g}`)}</h2>
        <${List} label=${t(`frasi.g.${g}`)}>
          ${phrasesOf(g).map((p) => html`<${ListRow} key=${p.id}
            icon=${speaking === p.id ? 'volume-2' : 'message-circle'} tone=${speaking === p.id ? 'success' : undefined}
            title=${t(`frasi.it.${p.id}`)} sub=${t(`frasi.en.${p.id}`)} onClick=${say(p.id)} />`)}
        <//>`)}
      <p class="t-caption t-muted">${t('frasi.caption')}</p>
    </div>
  <//>`;
}
