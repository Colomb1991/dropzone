// @ts-check
// "Nota qui" (DECISIONS 12.7): position → one sheet with the text first (typed, or dictated with
// the keyboard's microphone), the kind as chips, "Salva nota"; then "Foto" for 8 s.
import { html, useState, useEffect } from '../../../ui/html.js';
import { t, notes, settings, router, log } from '../../../core/api.js';
import { useAction } from '../../../ui/hooks.js';
import { Button, Sheet, Dialog, Chip, Icon, toast } from '../../../ui/kit/index.js';
import { NOTE_CATS, CATEGORIES, catLabelKey } from '../../../core/pure/catalog.js';
import { positionNow, saveNote, shootPhoto, needsPhotoNotice, isLocked } from '../logic/actions.js';
import { textProblem, TEXT_MAX } from '../logic/note-view.js';

const AFTER_MS = 8000;
const IMPRECISE_M = 50;
/** The kind of a note saved with its text only. */
const DEFAULT_CAT = 'altro';

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

/** The text field of both sheets: label, three lines, the rule about people, the count. */
function TextField({ id, text, setText, hint }) {
  const problem = textProblem(text);
  return html`<div class="field">
    <label class="field__label" for=${id}>${t('note.edit.textLabel')}</label>
    <textarea id=${id} class="field__control f-note-new" rows="3" maxlength=${TEXT_MAX} autofocus
      placeholder=${hint} value=${text} aria-invalid=${problem ? 'true' : null}
      onInput=${(e) => setText(e.target.value)}></textarea>
    ${problem === 'words'
      ? html`<p class="field__error"><${Icon} name="triangle-alert" /><span>${t('core.err.words')}</span></p>`
      : html`<p class="field__help"><span>${t('note.edit.textHelp')}</span>
          <span class="num">${t('core.field.count', { n: text.length, max: TEXT_MAX })}</span></p>`}
  </div>`;
}

/** "Scrivi" on a note saved as a kind alone: the text field, and "Fatto" right under it. */
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
  return html`<${Sheet} top open=${Boolean(note)} title=${note ? t(catLabelKey(note.cat)) : ''} onClose=${close}
    footer=${html`<${Button} block size="xl" icon="check" label=${t('core.action.done')} busy=${save.busy}
      disabled=${Boolean(problem)} onClick=${save.run} />`}>
    ${note && html`<${TextField} id="f-note-write" text=${text} setText=${setText}
      hint=${placeholder(note.cat) ?? t('note.capture.placeholder')} />`}
  <//>`;
}

/**
 * The sheet of "Nota qui". The text comes first; the kind is optional (a note with its text only
 * is "Altro"); a kind alone is still a note, to be completed later. It hangs from the top so the
 * keyboard never covers "Salva nota".
 * @param {{pos:any, busy:boolean, onSave:(cat:string, text:string)=>void, onClose:()=>void}} props
 */
function NewNoteSheet({ pos, busy, onSave, onClose }) {
  const [text, setText] = useState('');
  const [cat, setCat] = useState(/** @type {string|null} */ (null));
  useEffect(() => {
    setText('');
    setCat(null);
  }, [pos]);
  const problem = textProblem(text);
  const clean = text.trim();
  const empty = clean === '' && cat === null;
  const imprecise = pos && typeof pos.acc === 'number' && pos.acc > IMPRECISE_M;
  // Driving fast closes the sheet: what was typed is saved, not lost.
  const close = (why) => {
    if (why === 'moving' && pos && !problem && clean) onSave(cat ?? DEFAULT_CAT, clean);
    else onClose();
  };
  // The button lives in the footer: the kit keeps a top sheet's footer just above the keyboard.
  return html`<${Sheet} top open=${Boolean(pos)} title=${t('note.capture.here')} onClose=${close}
    footer=${html`<${Button} block size="xl" icon="check" label=${t('note.edit.save')} busy=${busy}
      disabled=${empty || Boolean(problem)} reason=${empty ? t('note.capture.needText') : undefined}
      onClick=${() => onSave(cat ?? DEFAULT_CAT, clean)} />`}>
    ${pos && html`
      <${TextField} id="f-note-new" text=${text} setText=${setText}
        hint=${(cat && placeholder(cat)) || t('note.capture.placeholder')} />
      <div class="f-note-scroll" role="group" aria-label=${t('note.capture.kind')}>
        ${NOTE_CATS.map((id) => html`<${Chip} key=${id} icon=${CATEGORIES[id].icon} label=${t(catLabelKey(id))}
          pressed=${cat === id} onToggle=${() => setCat(cat === id ? null : id)} />`)}
      </div>
      ${imprecise && html`<p class="t-caption t-muted">${t('note.capture.imprecise', { n: Math.round(pos.acc) })}</p>`}`}
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
  const [step, setStep] = useState(/** @type {'idle'|'warn'|'new'} */ ('idle'));
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
    setStep(settings.get('firstNoteWarned') === true ? 'new' : 'warn');
  });
  // The sheet closes only once the note is stored: a refused text stays on screen to be fixed.
  const save = useAction(async (cat, text) => {
    if (!pos) return;
    const note = await saveNote(pos, cat, text);
    setStep('idle');
    setPos(null);
    setSaved(note);
  });
  const understood = () => {
    settings.set('firstNoteWarned', true).catch((err) => log.error('note', err));
    setStep('new');
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

  // A note saved with its text needs only the photo; one saved as a kind alone can still be written.
  const afterBar = saved && html`<div class="btn-row f-note-after">
    ${!saved.text && html`<${Button} size="xl" icon="pencil" label=${t('note.capture.write')} onClick=${write} />`}
    <${Button} size="xl" variant="secondary" icon="camera" label=${t('note.capture.photo')} onClick=${shoot} />
  </div>`;
  const node = html`
    <${Dialog} open=${step === 'warn'} icon="info" title=${t('note.notice.firstTitle')} text=${t('note.notice.first')}
      actions=${[{ label: t('core.action.understood'), variant: 'primary', onClick: understood }]} />
    <${NewNoteSheet} pos=${step === 'new' ? pos : null} busy=${save.busy} onSave=${save.run} onClose=${cancel} />
    <${WriteSheet} note=${writing} onClose=${() => setWriting(null)} />
    ${photoCap.node}`;
  return { begin: (p) => start.run(p), busy: start.busy || save.busy, after: Boolean(saved), afterBar, node };
}
