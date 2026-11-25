// @ts-check
// "Scansiona" and "Incolla": one box that takes whatever the phone puts in it (the keyboard's own
// "Scansiona testo", dictation, typing, a pasted list). When the courier stops, the addresses are
// read out of it and shown as a list to tick, correct or remove; "Aggiungi N fermate" looks them up.
// The app never opens the camera and keeps no image: the text comes from the keyboard. The box is
// emptied when the search starts, and only street, number and town go on.
import { html, useState, useEffect, useMemo, useRef } from '../../../ui/html.js';
import { t, tn, clipboard, env, log } from '../../../core/api.js';
import { useLive, useSetting, useStore } from '../../../ui/hooks.js';
import { Field, Button, Icon, List, ListRow, Sheet, toast } from '../../../ui/kit/index.js';
import { resolveItems, resolveDoorPoint, QUERY_MAX } from '../logic/address.js';
import { readStops, TOWN_MAX } from '../logic/extract.js';
import {
  syncRows, toggleRow, editRow, removeRow, rowsToItems, rowsAfterSearch, correctedText, townsOf,
} from '../logic/intake.js';
import { listDoorPoints, searchOnline, onlineSearchState, addStops, loadTown, saveTown } from '../logic/data.js';

/** Typing or dictating: the box is read after this pause. A scan or a paste is read at once. */
const READ_PAUSE_MS = 500;
const BULK_PAUSE_MS = 60;
/** A change this long in one go is a scan or a paste, not a key. */
const BULK_CHARS = 15;
/** Under this many characters there is nothing to say yet about a box without addresses. */
const HINT_MIN_CHARS = 8;
const HOW = { ios: 'giro.scan.how.ios', android: 'giro.scan.how.android', other: 'giro.scan.how.other' };

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {import('../logic/intake.js').Row} row */
function rowTags(row) {
  const tags = [];
  if (row.miss) tags.push({ label: t('giro.rows.missing'), tone: 'warning', icon: 'triangle-alert' });
  if (row.sender) tags.push({ label: t('giro.rows.sender'), tone: 'neutral' });
  if (row.kind === 'coords') tags.push({ label: t('giro.search.pointSub'), tone: 'neutral' });
  else if (row.townFrom === 'default') tags.push({ label: t('giro.town.label'), tone: 'info' });
  else if (row.townFrom === 'previous') tags.push({ label: t('giro.rows.townAbove'), tone: 'info' });
  else if (!row.townFrom) tags.push({ label: t('giro.rows.noTown'), tone: 'warning' });
  return tags;
}

/** "Città di oggi", set once for the route. */
function TownSheet({ town, onSave, onClose }) {
  const [text, setText] = useState(town);
  const footer = html`<${Button} block size="xl" icon="check" label=${t('core.action.save')}
    onClick=${() => onSave(text)} />`;
  return html`<${Sheet} open title=${t('giro.town.label')} onClose=${onClose} footer=${footer}>
    <${Field} label=${t('giro.town.field')} value=${text} onInput=${setText} max=${TOWN_MAX}
      placeholder=${t('giro.town.placeholder')} helper=${t('giro.town.help')} />
  <//>`;
}

/** One row of the list: correct its text, or take it out. */
function RowSheet({ row, onSave, onRemove, onClose }) {
  const [text, setText] = useState(row.text);
  const address = row.kind === 'address';
  const footer = html`
    ${address && html`<${Button} block size="xl" icon="check" label=${t('core.action.save')}
      disabled=${!text.trim()} onClick=${() => onSave(text)} />`}
    <${Button} block variant="ghost" icon="trash-2" label=${t('giro.rows.remove')} onClick=${onRemove} />`;
  return html`<${Sheet} open title=${t('giro.rows.edit')} onClose=${onClose} footer=${footer}>
    ${address
      ? html`<${Field} label=${t('giro.search.label')} value=${text} onInput=${setText} max=${QUERY_MAX}
          placeholder=${t('giro.search.placeholder')} helper=${t('giro.search.help')} />`
      : html`<p class="t-body-m">${row.text}${row.sub ? ` · ${row.sub}` : ''}</p>`}
  <//>`;
}

/**
 * @param {{variant:'scan'|'paste', moving:boolean, onAskOnline:()=>void, onPending?:(count:number)=>void}} props
 *   `onPending`: how many rows wait to be added (the screen then keeps "Vedi il giro" quiet)
 */
export function IntakePane({ variant, moving, onAskOnline, onPending }) {
  const scan = variant === 'scan';
  const [text, setText] = useState('');
  const [read, setRead] = useState('');
  const [rows, setRows] = useState(/** @type {import('../logic/intake.js').Row[]} */ ([]));
  const [hidden, setHidden] = useState(() => new Set());
  const [editing, setEditing] = useState(/** @type {string|null} */ (null));
  const [townOpen, setTownOpen] = useState(false);
  const [job, setJob] = useState(/** @type {{done:number, total:number}|null} */ (null));
  const [result, setResult] = useState(/** @type {any} */ (null));
  const [photonOn] = useSetting('svc.photon');
  const [asked] = useSetting('giro.photonAsked');
  const sandbox = useStore((s) => s.sandbox);
  const { data: town = '' } = useLive(['kv', 'route'], loadTown);
  const { data: doors } = useLive(['doorPoints'], listDoorPoints);
  const box = useRef(/** @type {HTMLElement|null} */ (null));
  const bulk = useRef(false);
  const seq = useRef(0);
  const halt = useRef(false);
  const alive = useRef(true);
  const pending = useRef(onPending);
  pending.current = onPending;

  useEffect(() => {
    // "Scansiona" opens ready to receive: the keyboard is where the scan and the dictation are. After
    // the screen has moved the focus to its title.
    const timer = scan && !moving
      ? setTimeout(() => /** @type {any} */ (box.current)?.querySelector?.('textarea')?.focus(), 80) : 0;
    return () => {
      alive.current = false;
      clearTimeout(timer);
      pending.current?.(0);
    };
  }, []);

  // The box is read when the courier stops typing or dictating.
  useEffect(() => {
    const timer = setTimeout(() => setRead(text), bulk.current ? BULK_PAUSE_MS : READ_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const towns = useMemo(() => townsOf(doors ?? []), [doors]);
  const parsed = useMemo(() => readStops(read, { town, towns }), [read, town, towns]);
  useEffect(() => {
    setRows((cur) => syncRows(cur, parsed.items, hidden));
  }, [parsed, hidden]);
  useEffect(() => {
    pending.current?.(rows.length);
  }, [rows.length]);
  // The button is at the bottom of the list, the outcome is written at the top: bring it into view.
  const outcome = useRef(/** @type {HTMLElement|null} */ (null));
  useEffect(() => {
    if (result) /** @type {any} */ (outcome.current)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [result]);

  const input = (value) => {
    bulk.current = Math.abs(value.length - text.length) >= BULK_CHARS;
    setText(value);
  };
  const fromClipboard = () => {
    // First statement of the tap: reading the clipboard needs the user activation.
    clipboard.readText().then((clip) => {
      if (!clip || !clip.trim()) toast(t('giro.paste.clipboardEmpty'), { icon: 'info' });
      else input(text.trim() ? `${text.trimEnd()}\n${clip}` : clip);
    });
  };
  const hide = (id) => {
    if (id) setHidden((cur) => new Set(cur).add(id));
  };
  const change = (res) => {
    setRows(res.rows);
    hide(res.hide);
    setEditing(null);
  };
  const setTown = (value) => {
    setTownOpen(false);
    saveTown(value).catch((err) => log.error('giro', err));
  };

  const picked = rows.filter((r) => r.checked);
  const count = picked.length;

  const run = async () => {
    // The first search with the service still off: explain once; the courier then taps again.
    const online = picked.some((r) => r.kind === 'address' && !resolveDoorPoint(r.text, doors ?? []));
    if (online && photonOn !== true && asked !== true && !sandbox) {
      onAskOnline();
      return;
    }
    const all = rows.map((r) => ({ ...r, pinned: true }));
    const items = rowsToItems(all);
    // From here the box is gone: whatever else it held is not shown again.
    bulk.current = true;
    setText('');
    setRead('');
    setHidden(new Set());
    setRows(all);
    halt.current = false;
    setResult(null);
    setJob({ done: 0, total: items.length });
    try {
      const res = await resolveItems(items, {
        doorPoints: await listDoorPoints(),
        online: onlineSearchState().allowed ? (line) => searchOnline(line) : null,
        wait: pause,
        onProgress: (done, total) => alive.current && setJob({ done, total }),
        stopped: () => halt.current || !alive.current,
      });
      // Whatever was found is added, also when the courier stopped or left the screen.
      const out = res.stops.length ? await addStops(res.stops) : { added: 0, repeated: 0, full: 0 };
      if (!alive.current) return;
      setRows(rowsAfterSearch(all, res));
      setResult({ added: out.added, repeated: out.repeated, full: out.full, missing: res.missing.length,
        learned: res.learned, down: res.missing.length ? res.down : null });
    } catch (err) {
      log.error('giro', err);
      if (alive.current) toast(t('core.err.generic'), { icon: 'triangle-alert' });
    } finally {
      if (alive.current) setJob(null);
    }
  };

  if (job) {
    const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
    return html`<div class="f-giro-result" role="status">
      <p class="f-giro-result__line">${t('giro.paste.progress', job)}</p>
      <div class="f-giro-bar" role="progressbar" aria-label=${t('giro.paste.progress', job)} aria-valuemin="0"
        aria-valuemax=${job.total} aria-valuenow=${job.done}>
        <span class="f-giro-bar__fill" style=${{ width: `${pct}%` }}></span>
      </div>
      <p class="t-caption t-muted">${t('giro.paste.slow')}</p>
      <${Button} variant="secondary" icon="square" label=${t('giro.paste.stop')} onClick=${() => {
        halt.current = true;
      }} />
    </div>`;
  }

  const missingWhy = result?.down === 'offline' ? 'giro.paste.missingOffline'
    : result?.down === 'service-off' ? 'giro.paste.missingOff' : null;
  const editRowNow = editing ? rows.find((r) => r.id === editing) : null;
  const nothing = rows.length === 0 && read === text && read.trim().length >= HINT_MIN_CHARS;
  const title = tn('giro.rows.title', rows.length);

  return html`<div class="stack">
    ${result && html`<div class="f-giro-result" role="status" ref=${outcome}>
      <p class="f-giro-result__line" data-tone=${result.added ? 'success' : 'neutral'}>
        <${Icon} name=${result.added ? 'check' : 'info'} />
        <span>${result.added ? tn('giro.added.n', result.added) : t('giro.added.none')}</span>
      </p>
      ${result.learned > 0 && html`<p class="t-body-m t-muted">${tn('giro.paste.learned', result.learned)}</p>`}
      ${result.repeated > 0 && html`<p class="t-body-m t-muted">${tn('giro.repeated.n', result.repeated)}</p>`}
      ${result.full > 0 && html`<p class="t-body-m t-muted">${t('giro.full')}</p>`}
      ${result.missing > 0 && html`
        <p class="f-giro-result__line" data-tone="warning">
          <${Icon} name="triangle-alert" /><span>${tn('giro.paste.missing', result.missing)}</span>
        </p>
        <p class="t-body-m t-muted">${missingWhy ? `${t(missingWhy)} ` : ''}${t('giro.paste.missingHelp')}</p>
        ${result.down === 'service-off' && !sandbox && html`<${Button} variant="secondary" icon="search"
          label=${t('giro.photon.on')} onClick=${onAskOnline} />`}`}
    </div>`}
    ${scan && html`<ul class="f-giro-how">
      <li><${Icon} name="camera" /><span>${t(HOW[env.os()] ?? HOW.other)}</span></li>
      <li><${Icon} name="mic" /><span>${t('giro.scan.dictate')}</span></li>
    </ul>`}
    <div class=${scan ? 'f-giro-box f-giro-box--scan' : 'f-giro-box'} ref=${box}>
      <${Field} type="textarea" label=${t(scan ? 'giro.scan.label' : 'giro.paste.label')} value=${text}
        onInput=${input} placeholder=${t(scan ? 'giro.scan.placeholder' : 'giro.paste.placeholder')}
        helper=${t(scan ? 'giro.scan.help' : 'giro.paste.help')} autocomplete="off" />
    </div>
    ${!scan && html`<${Button} block variant="secondary" icon="clipboard-list" label=${t('giro.paste.clipboard')}
      onClick=${fromClipboard} />`}
    <${List} label=${t('giro.town.label')}>
      <${ListRow} icon="building-2" title=${t('giro.town.label')} sub=${town || t('giro.town.unset')}
        trailing=${html`<${Icon} name="pencil" label=${t('core.action.edit')} />`} onClick=${() => setTownOpen(true)} />
    <//>
    ${nothing && html`<p class="t-body-m t-muted" role="status">${t('giro.rows.none')}</p>`}
    ${rows.length > 0 && html`
      <h2 class="section-title" role="status">${title}</h2>
      <${List} label=${title}>
        ${rows.map((r) => html`<div class="f-giro-pick" key=${r.id}>
          <${ListRow} title=${r.text} sub=${r.sub || undefined} tags=${rowTags(r)} selected=${r.checked}
            onClick=${() => setRows((cur) => toggleRow(cur, r.id))} />
          <${Button} variant="ghost" iconOnly icon="pencil" label=${t('giro.rows.editOne', { label: r.text })}
            onClick=${() => setEditing(r.id)} />
        </div>`)}
      <//>`}
    ${parsed.over > 0 && html`<p class="t-caption t-muted">${t('giro.paste.over')}</p>`}
    <${Button} block size="xl" icon="plus" disabled=${count === 0 || moving}
      label=${count ? tn('giro.rows.add', count) : t('giro.add')} onClick=${run} />
    ${editRowNow && html`<${RowSheet} key=${editRowNow.id} row=${editRowNow} onClose=${() => setEditing(null)}
      onRemove=${() => change(removeRow(rows, editRowNow.id))}
      onSave=${(value) => change(editRow(rows, editRowNow.id, correctedText(value, { town, towns }),
        `e${++seq.current}`))} />`}
    ${townOpen && html`<${TownSheet} town=${town} onSave=${setTown} onClose=${() => setTownOpen(false)} />`}
  </div>`;
}
