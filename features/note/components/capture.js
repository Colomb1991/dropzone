// @ts-check
// "Nota qui" (DECISIONS 12.7): position → one sheet with the text first (typed, or dictated with
// the keyboard's microphone), the kind as chips, "Salva nota"; then "Foto" for 8 s.
import { html, useState, useEffect, useRef } from '../../../ui/html.js';
import { t, notes, settings, log, AppError } from '../../../core/api.js';
import { useAction } from '../../../ui/hooks.js';
import { Button, Sheet, Dialog, Chip, Icon } from '../../../ui/kit/index.js';
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
 * A new capture is a new component (the caller gives it a `key`): it starts empty every time.
 * @param {{open:boolean, fix:any, busy:boolean, onSave:(cat:string, text:string)=>void,
 *   onClose:()=>void}} props `fix`: undefined while the phone is still reading the position, null
 *   when it found none
 */
function NewNoteSheet({ open, fix, busy, onSave, onClose }) {
  const [text, setText] = useState('');
  const [cat, setCat] = useState(/** @type {string|null} */ (null));
  const problem = textProblem(text);
  const clean = text.trim();
  const empty = clean === '' && cat === null;
  const imprecise = fix && typeof fix.acc === 'number' && fix.acc > IMPRECISE_M;
  // Driving fast closes the sheet: what was typed is saved, not lost.
  const close = (why) => {
    if (why === 'moving' && !problem && clean) onSave(cat ?? DEFAULT_CAT, clean);
    else onClose();
  };
  // The button lives in the footer: the kit keeps a top sheet's footer just above the keyboard.
  return html`<${Sheet} top open=${open} title=${t('note.capture.here')} onClose=${close}
    footer=${html`<${Button} block size="xl" icon="check" label=${t('note.edit.save')} busy=${busy}
      disabled=${empty || Boolean(problem)} reason=${empty ? t('note.capture.needText') : undefined}
      onClick=${() => onSave(cat ?? DEFAULT_CAT, clean)} />`}>
    ${open && html`
      <${TextField} id="f-note-new" text=${text} setText=${setText}
        hint=${(cat && placeholder(cat)) || t('note.capture.placeholder')} />
      <div class="f-note-scroll" role="group" aria-label=${t('note.capture.kind')}>
        ${NOTE_CATS.map((id) => html`<${Chip} key=${id} icon=${CATEGORIES[id].icon} label=${t(catLabelKey(id))}
          pressed=${cat === id} onToggle=${() => setCat(cat === id ? null : id)} />`)}
      </div>
      ${imprecise && html`<p class="t-caption t-muted">${t('note.capture.imprecise', { n: Math.round(fix.acc) })}</p>`}
      ${fix === null && html`<p class="t-caption t-muted" role="status">${t('note.here.noFix')}</p>`}`}
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
  const [step, setStep] = useState(/** @type {'idle'|'warn'|'new'} */ ('idle'));
  const [seq, setSeq] = useState(0);
  const [fix, setFix] = useState(/** @type {any} */ (undefined));
  const [saved, setSaved] = useState(/** @type {any} */ (null));
  const [writing, setWriting] = useState(/** @type {any} */ (null));
  const where = useRef(/** @type {Promise<any>} */ (Promise.resolve(null)));
  const photoCap = usePhotoCapture();

  useEffect(() => {
    if (!saved) return undefined;
    const timer = setTimeout(() => setSaved(null), AFTER_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  /** Reads the position of this capture; a later reading replaces an earlier one. */
  const locate = (given) => {
    // A note saved where the courier stands is not announced back in the same shift.
    const job = given ? Promise.resolve(given)
      : positionNow().then((own) => own && { ...own, here: true }, () => null);
    where.current = job;
    setFix(undefined);
    job.then((p) => {
      if (where.current === job) setFix(p ?? null);
    });
    return job;
  };
  // The sheet opens inside the tap, with no wait: the phone can raise its keyboard at once and
  // the courier starts to type or dictate while the position is being read.
  const begin = (given) => {
    if (isLocked() || step !== 'idle') return;
    locate(given);
    setSeq((n) => n + 1);
    setStep(settings.get('firstNoteWarned') === true ? 'new' : 'warn');
  };
  // The sheet closes only once the note is stored: a refused text, or a position not found yet,
  // leaves what was typed on screen.
  const save = useAction(async (cat, text) => {
    const p = (await where.current) ?? (await locate());
    if (!p) throw new AppError('no-position', 'core.err.noPosition');
    const note = await saveNote(p, cat, text);
    setStep('idle');
    setSaved(note);
  });
  const understood = () => {
    settings.set('firstNoteWarned', true).catch((err) => log.error('note', err));
    setStep('new');
  };
  const cancel = () => setStep('idle');
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
    <${NewNoteSheet} key=${seq} open=${step === 'new'} fix=${fix} busy=${save.busy} onSave=${save.run}
      onClose=${cancel} />
    <${WriteSheet} note=${writing} onClose=${() => setWriting(null)} />
    ${photoCap.node}`;
  return { begin, busy: save.busy, after: Boolean(saved), afterBar, node };
}
