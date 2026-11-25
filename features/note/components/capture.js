// @ts-check
// "Nota qui" in two taps (SPEC 4.3): position → category → saved; then "Scrivi" / "Foto" for 8 s.
import { html, useState, useEffect } from '../../../ui/html.js';
import { t, notes, settings, router, log } from '../../../core/api.js';
import { useAction } from '../../../ui/hooks.js';
import { Button, Sheet, Dialog, Tile, Icon, toast } from '../../../ui/kit/index.js';
import { NOTE_CATS, CATEGORIES, catLabelKey } from '../../../core/pure/catalog.js';
import { positionNow, saveNote, shootPhoto, needsPhotoNotice, isLocked } from '../logic/actions.js';
import { textProblem, TEXT_MAX } from '../logic/note-view.js';

const AFTER_MS = 8000;
const IMPRECISE_M = 50;

/**
 * Camera with the first-photo notice (legal notice 4). `take(id)` must be called from a click.
 * @param {(id:string) => void} [onDone]
 * @returns {{take:(id:string)=>void, busy:boolean, node:any}}
 */
export function usePhotoCapture(onDone) {
  const [askFor, setAskFor] = useState(/** @type {string|null} */ (null));
  const shoot = useAction(async (id) => {
    if (await shootPhoto(id)) onDone?.(id);
  });
  const take = (id) => (needsPhotoNotice() ? setAskFor(id) : shoot.run(id));
  const accept = () => {
    const id = askFor;
    // The camera opens inside this same tap; the flag is stored on the side.
    if (id) shoot.run(id);
    settings.set('firstPhotoWarned', true).catch((err) => log.error('note', err));
    setAskFor(null);
  };
  const node = html`<${Dialog} open=${askFor !== null} icon="camera" title=${t('note.notice.photoTitle')}
    text=${t('note.notice.photo')}
    actions=${[{ label: t('core.action.understood'), variant: 'primary', onClick: accept }]} />`;
  return { take, busy: shoot.busy, node };
}

/** Sheet with only the text field, focused (SPEC 4.3 "Scrivi"). */
function WriteSheet({ note, onClose }) {
  const [text, setText] = useState('');
  useEffect(() => setText(note?.text ?? ''), [note?.id]);
  const problem = textProblem(text);
  const save = useAction(async () => {
    if (note && text.trim() !== note.text) await notes.updateNote(note.id, { text: text.trim() });
    onClose();
  });
  // Driving fast closes the sheet: what was typed is kept on the note.
  const close = (why) => {
    if (why === 'moving' && note && !problem && text.trim()) {
      notes.updateNote(note.id, { text: text.trim() }).catch((err) => log.error('note', err));
    }
    onClose();
  };
  return html`<${Sheet} open=${Boolean(note)} title=${note ? t(catLabelKey(note.cat)) : ''} onClose=${close}
    footer=${html`<${Button} block size="xl" icon="check" label=${t('core.action.done')} busy=${save.busy}
      disabled=${Boolean(problem)} onClick=${save.run} />`}>
    ${note && html`<div class="field">
      <label class="field__label" for="f-note-write">${t('note.edit.textLabel')}</label>
      <textarea id="f-note-write" class="field__control" rows="3" maxlength=${TEXT_MAX} autofocus
        placeholder=${placeholder(note.cat)} value=${text} aria-invalid=${problem ? 'true' : null}
        onInput=${(e) => setText(e.target.value)}></textarea>
      ${problem === 'words'
        ? html`<p class="field__error"><${Icon} name="triangle-alert" /><span>${t('core.err.words')}</span></p>`
        : html`<p class="field__help"><span>${t('note.edit.textHelp')}</span>
            <span class="num">${t('core.field.count', { n: text.length, max: TEXT_MAX })}</span></p>`}
    </div>`}
  <//>`;
}

const HINTS = {
  ingresso: 'note.hint.ingresso', cane: 'note.hint.cane', parcheggio: 'note.hint.parcheggio',
  orari: 'note.hint.orari', strada: 'note.hint.strada', consegna: 'note.hint.consegna',
  negozio: 'note.hint.negozio',
};

/** Placeholder of the text field by category, or null. */
export function placeholder(cat) {
  return HINTS[cat] ? t(HINTS[cat]) : null;
}

/**
 * The whole capture flow as a hook. The caller renders `node` once and, while `after` is set,
 * `afterBar` in place of its sticky button.
 * @returns {{begin:(pos?:{lat:number, lon:number, acc:number|null, at:number})=>void, busy:boolean,
 *   after:boolean, afterBar:any, node:any}}
 */
export function useCapture() {
  const [pos, setPos] = useState(/** @type {any} */ (null));
  const [step, setStep] = useState(/** @type {'idle'|'warn'|'cat'} */ ('idle'));
  const [saved, setSaved] = useState(/** @type {any} */ (null));
  const [writing, setWriting] = useState(/** @type {any} */ (null));
  const photoCap = usePhotoCapture();

  useEffect(() => {
    if (!saved) return undefined;
    const timer = setTimeout(() => setSaved(null), AFTER_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  const start = useAction(async (given) => {
    if (isLocked()) return;
    // A note saved where the courier stands is not announced back in the same shift.
    const own = given ? null : await positionNow();
    const p = given ?? (own && { ...own, here: true });
    if (!p) {
      // No fix: the map with the crosshair is the other way to place a note.
      toast(t('core.err.noPosition'), { icon: 'triangle-alert' });
      router.navigate('/note', { query: { vista: 'mappa' } });
      return;
    }
    setPos(p);
    setStep(settings.get('firstNoteWarned') === true ? 'cat' : 'warn');
  });
  const pick = useAction(async (cat) => {
    const p = pos;
    setStep('idle');
    setPos(null);
    if (p) setSaved(await saveNote(p, cat));
  });
  const understood = () => {
    settings.set('firstNoteWarned', true).catch((err) => log.error('note', err));
    setStep('cat');
  };
  const cancel = () => {
    setStep('idle');
    setPos(null);
  };
  const write = () => {
    setWriting(saved);
    setSaved(null);
  };
  const shoot = () => {
    const id = saved.id;
    photoCap.take(id);
    setSaved(null);
  };

  const afterBar = saved && html`<div class="btn-row f-note-after">
    <${Button} size="xl" icon="pencil" label=${t('note.capture.write')} onClick=${write} />
    <${Button} size="xl" variant="secondary" icon="camera" label=${t('note.capture.photo')} onClick=${shoot} />
  </div>`;
  const imprecise = pos && typeof pos.acc === 'number' && pos.acc > IMPRECISE_M;
  const node = html`
    <${Dialog} open=${step === 'warn'} icon="info" title=${t('note.notice.firstTitle')} text=${t('note.notice.first')}
      actions=${[{ label: t('core.action.understood'), variant: 'primary', onClick: understood }]} />
    <${Sheet} open=${step === 'cat'} title=${t('note.capture.what')} onClose=${cancel}>
      ${imprecise && html`<p class="t-body-m t-muted">${t('note.capture.imprecise', { n: Math.round(pos.acc) })}</p>`}
      <div class="f-note-cats">
        ${NOTE_CATS.map((id) => html`<${Tile} key=${id} icon=${CATEGORIES[id].icon} tone=${CATEGORIES[id].tone}
          label=${t(catLabelKey(id))} disabled=${pick.busy} onClick=${() => pick.run(id)} />`)}
      </div>
    <//>
    <${WriteSheet} note=${writing} onClose=${() => setWriting(null)} />
    ${photoCap.node}`;
  return { begin: (p) => start.run(p), busy: start.busy || pick.busy, after: Boolean(saved), afterBar, node };
}
