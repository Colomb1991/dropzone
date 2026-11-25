// @ts-check
// Modifica nota: category, text, photo, schedule ("Quando avvisare"), business and private toggles, position.
import { html, useState, useEffect, useRef } from '../../../ui/html.js';
import { t, notes, router } from '../../../core/api.js';
import { useLive, useLang, useAction } from '../../../ui/hooks.js';
import { Screen, Chip, Chips, Field, Button, Toggle, Sheet, Keypad, keypadTime, MapView, Thumb, Empty, toast }
  from '../../../ui/kit/index.js';
import { NOTE_CATS, CATEGORIES, catLabelKey } from '../../../core/pure/catalog.js';
import { textProblem, draftSchedule, TEXT_MAX } from '../logic/note-view.js';
import { usePhotoCapture, placeholder } from '../components/capture.js';

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const DAY_KEYS = { 1: 'note.day.1', 2: 'note.day.2', 3: 'note.day.3', 4: 'note.day.4', 5: 'note.day.5',
  6: 'note.day.6', 7: 'note.day.7' };
// Named so the import audit never reads a quoted "from" as a module specifier.
const FROM = 'from';
const TO = 'to';
const NEW_WINDOW ={ from: '07:00', to: '14:00' };

function fromNote(n) {
  return {
    cat: n.cat, text: n.text, biz: n.biz, private: n.private, lat: n.lat, lon: n.lon, acc: n.acc,
    always: !n.schedule, days: n.schedule?.days ?? [], windows: n.schedule?.windows ?? [],
  };
}

/** Days, up to two windows, each time typed on the keypad. */
function ScheduleEditor({ draft, patch }) {
  const [pick, setPick] = useState(/** @type {{i:number, key:string, digits:string}|null} */ (null));
  const toggleDay = (d) => patch({ days: draft.days.includes(d) ? draft.days.filter((x) => x !== d)
    : [...draft.days, d] });
  const setTime = () => {
    const time = pick && keypadTime(pick.digits);
    if (!pick || !time) return;
    patch({ windows: draft.windows.map((w, i) => (i === pick.i ? { ...w, [pick.key]: time } : w)) });
    setPick(null);
  };
  const timeButton = (i, key) => html`<${Button} variant="secondary" icon="clock"
    label=${t(key === FROM ? 'note.edit.timeFrom' : 'note.edit.timeTo', { time: draft.windows[i][key] })}
    onClick=${() => setPick({ i, key, digits: '' })} />`;
  return html`
    <${Chips} label=${t('note.edit.days')}>
      ${DAYS.map((d) => html`<${Chip} key=${d} label=${t(DAY_KEYS[d])} pressed=${draft.days.includes(d)}
        onToggle=${() => toggleDay(d)} />`)}
    <//>
    ${draft.days.length === 0 && html`<p class="t-caption t-muted">${t('note.edit.pickDay')}</p>`}
    ${draft.windows.map((w, i) => html`<div class="f-note-window" key=${i}>
      ${timeButton(i, FROM)}${timeButton(i, TO)}
      <${Button} variant="ghost" iconOnly icon="x" label=${t('note.edit.removeWindow')}
        onClick=${() => patch({ windows: draft.windows.filter((_, j) => j !== i) })} />
    </div>`)}
    ${draft.windows.length === 0 && html`<p class="t-caption t-muted">${t('note.edit.allDay')}</p>`}
    ${draft.windows.length < 2 && html`<${Button} variant="secondary" icon="plus" label=${t('note.edit.addWindow')}
      onClick=${() => patch({ windows: [...draft.windows, NEW_WINDOW] })} />`}
    <${Sheet} open=${pick !== null} title=${t(pick?.key === TO ? 'note.edit.toTitle' : 'note.edit.fromTitle')}
      onClose=${() => setPick(null)}>
      ${pick && html`<${Keypad} mode="time" value=${pick.digits} label=${t('note.edit.timeLabel')}
        onChange=${(digits) => setPick({ ...pick, digits })} onDone=${setTime} />`}
    <//>`;
}

/** "Sposta sulla mappa": the crosshair marks the new place. */
function MoveSheet({ open, center, onPick, onClose }) {
  const map = useRef(/** @type {any} */ (null));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!open) setReady(false);
  }, [open]);
  const done = () => {
    try {
      onPick(map.current.getCenter());
    } catch (err) {
      onClose();
    }
  };
  return html`<${Sheet} open=${open} title=${t('note.edit.move')} onClose=${onClose}
    footer=${html`<${Button} block size="xl" icon="crosshair" label=${t('note.edit.moveHere')} disabled=${!ready}
      onClick=${done} />`}>
    ${open && html`<${MapView} center=${center} zoom=${17} pins=${[]} crosshair fallback=${null}
      onReady=${(m) => {
        map.current = m;
        setReady(true);
      }} />`}
  <//>`;
}

/** @param {{params:{id:string}}} props */
export default function NoteEdit({ params }) {
  useLang();
  const id = params.id;
  const { data: note, loading } = useLive(['notes', 'media'], () => notes.getNote(id), [id]);
  const [draft, setDraft] = useState(/** @type {any} */ (null));
  const [moveOpen, setMoveOpen] = useState(false);
  const photoCap = usePhotoCapture();
  useEffect(() => {
    if (note && !draft) setDraft(fromNote(note));
  }, [note]);
  const patch = (p) => setDraft((d) => ({ ...d, ...p }));

  const save = useAction(async () => {
    const schedule = draftSchedule(draft.always, draft.days, draft.windows);
    if (schedule === undefined) return;
    await notes.updateNote(id, { cat: draft.cat, text: draft.text.trim(), schedule, biz: draft.biz,
      private: draft.private, lat: draft.lat, lon: draft.lon, acc: draft.acc });
    toast(t('note.saved.toast'), { icon: 'check' });
    router.back(`/note/${id}`);
  });
  const dropPhoto = useAction(() => notes.setNoteMedia(id, 'photo', null));

  if (!note || !draft) {
    return html`<${Screen} title=${t('note.edit.title')} back="/note">
      ${loading || note ? html`<p class="t-body-m t-muted">${t('core.state.loading')}</p>`
        : html`<${Empty} icon="map-pin" title=${t('note.detail.missing')} />`}
    <//>`;
  }
  const problem = textProblem(draft.text);
  const scheduleOk = draftSchedule(draft.always, draft.days, draft.windows) !== undefined;
  const setCat = (cat) => patch({ cat, biz: cat === 'negozio' ? true : draft.biz });
  const sticky = html`<${Button} block size="xl" icon="check" label=${t('note.edit.save')} busy=${save.busy}
    disabled=${Boolean(problem) || !scheduleOk} reason=${scheduleOk ? undefined : t('note.edit.pickDay')}
    onClick=${save.run} />`;

  return html`<${Screen} title=${t('note.edit.title')} back=${`/note/${id}`} sticky=${sticky}>
    <div class="f-note-scroll" role="group" aria-label=${t('note.edit.category')}>
      ${NOTE_CATS.map((c) => html`<${Chip} key=${c} icon=${CATEGORIES[c].icon} label=${t(catLabelKey(c))}
        pressed=${draft.cat === c} onToggle=${() => setCat(c)} />`)}
    </div>
    <${Field} type="textarea" label=${t('note.edit.textLabel')} value=${draft.text} max=${TEXT_MAX}
      placeholder=${placeholder(draft.cat) ?? undefined} helper=${t('note.edit.textHelp')}
      error=${problem === 'words' ? t('core.err.words') : undefined} onInput=${(text) => patch({ text })} />
    <div class="cluster">
      ${note.photoId && html`<${Thumb} mediaId=${note.photoId} size=${96} alt="" />`}
      <${Button} variant="secondary" icon="camera" busy=${photoCap.busy}
        label=${t(note.photoId ? 'note.edit.photoChange' : 'note.edit.photoTake')}
        onClick=${() => photoCap.take(id)} />
      ${note.photoId && html`<${Button} variant="ghost" icon="trash-2" label=${t('note.edit.photoRemove')}
        busy=${dropPhoto.busy} onClick=${dropPhoto.run} />`}
    </div>
    <h2 class="section-title">${t('note.edit.when')}</h2>
    <${Chips} label=${t('note.edit.when')}>
      <${Chip} label=${t('note.edit.always')} pressed=${draft.always} onToggle=${() => patch({ always: true })} />
      <${Chip} label=${t('note.edit.timed')} pressed=${!draft.always} onToggle=${() => patch({ always: false })} />
    <//>
    ${!draft.always && html`<${ScheduleEditor} draft=${draft} patch=${patch} />`}
    <${Toggle} label=${t('note.edit.biz')} checked=${draft.biz} onChange=${(biz) => patch({ biz })} />
    <${Toggle} label=${t('core.tag.private')} sub=${t('note.detail.privateHelp')} checked=${draft.private}
      onChange=${(v) => patch({ private: v })} />
    <${Button} block variant="secondary" icon="map" label=${t('note.edit.move')} onClick=${() => setMoveOpen(true)} />
    ${(draft.lat !== note.lat || draft.lon !== note.lon)
      && html`<p class="t-caption t-muted">${t('note.edit.moved')}</p>`}
    <${MoveSheet} open=${moveOpen} center=${{ lat: draft.lat, lon: draft.lon }} onClose=${() => setMoveOpen(false)}
      onPick=${(p) => {
        patch({ lat: Math.round(p.lat * 1e6) / 1e6, lon: Math.round(p.lon * 1e6) / 1e6, acc: null });
        setMoveOpen(false);
      }} />
    ${photoCap.node}
  <//>`;
}
