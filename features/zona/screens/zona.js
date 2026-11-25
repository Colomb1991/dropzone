// @ts-check
// Passa la zona: home → (select → send) for the export, (preview → apply) for the import, undo for 24 h.
import { html, useState, useEffect, useRef } from '../../../ui/html.js';
import { useLive, useAction, useLang } from '../../../ui/hooks.js';
import {
  Screen, Art, Tiles, Tile, List, ListRow, Chips, Chip, Field, Toggle, Button, Banner, Card, Empty, Thumb, toast,
} from '../../../ui/kit/index.js';
import { t, tn, clock, format, share, cues, router, log, AppError } from '../../../core/api.js';
import { NOTE_CATS, category, catLabelKey } from '../../../core/pure/catalog.js';
import { ZONE_LIMITS } from '../logic/zone-file.js';
import {
  listExportable, photoBytes, prepareZoneFile, previewZoneFile, applyZoneImport, lastImport, undoImport,
} from '../zone-io.js';

const PREVIEW_ROWS = 30;
const mb = (bytes) => format.number(bytes / 1048576, 1);
const noteTitle = (n) => n.text || `${t(catLabelKey(n.cat))} · ${format.dateShort(n.updatedAt)}`;
const REASON_KEYS = { 'not-zone': 'zona.err.notZone', 'too-new': 'zona.err.tooNew', 'too-big': 'zona.err.tooBig' };

function undoToast(id, count) {
  toast(tn('zona.import.done', count), {
    icon: 'check',
    action: { label: t('core.action.undo'), onClick: () => undoImport(id).then(
      (n) => toast(tn('zona.undo.done', n)), (err) => log.error('zona', err)) },
  });
}

function SelectStep({ list, picked, setPicked, onNext }) {
  const cats = NOTE_CATS.filter((c) => list.some((n) => n.cat === c));
  const all = list.length > 0 && picked.size === list.length;
  const flip = (ids, on) => {
    const next = new Set(picked);
    for (const id of ids) (on ? next.add(id) : next.delete(id));
    setPicked(next);
  };
  const catIds = (c) => list.filter((n) => n.cat === c).map((n) => n.id);
  const catOn = (c) => catIds(c).every((id) => picked.has(id));
  if (list.length === 0) {
    return html`<${Empty} icon="map-pin" title=${t('zona.export.empty')} text=${t('zona.export.emptyHint')} />`;
  }
  return html`<div class="stack">
    <${Chips} label=${t('zona.export.pick')}>
      <${Chip} label=${t('zona.export.all', { n: list.length })} pressed=${all}
        onToggle=${() => flip(list.map((n) => n.id), !all)} />
      ${cats.map((c) => html`<${Chip} label=${t(catLabelKey(c))} icon=${category(c).icon} pressed=${catOn(c)}
        onToggle=${() => flip(catIds(c), !catOn(c))} />`)}
    <//>
    <${List} label=${t('zona.export.pick')}>
      ${list.map((n) => html`<${ListRow} key=${n.id} title=${noteTitle(n)} sub=${t(catLabelKey(n.cat))}
        selected=${picked.has(n.id)} onClick=${() => flip([n.id], !picked.has(n.id))} />`)}
    <//>
    <${Button} size="xl" block label=${t('core.action.next')} disabled=${picked.size === 0}
      reason=${t('zona.export.none')} onClick=${onNext} />
  </div>`;
}

function SendStep({ list, onDone }) {
  const [name, setName] = useState(() => t('zona.export.preset', { date: format.dateShort(clock.now()) }));
  const [withPhotos, setWithPhotos] = useState(false);
  const [built, setBuilt] = useState(/** @type {any} */ (null));
  const { data: photoSize } = useLive([], () => photoBytes(list), [list]);
  const photoNotes = list.filter((n) => n.photoId);

  // Prepare, then tap: the file is rebuilt whenever an option changes, the button waits for it.
  useEffect(() => {
    setBuilt(null);
    let alive = true;
    const timer = setTimeout(() => {
      prepareZoneFile({ name, list, includePhotos: withPhotos }).then(
        (b) => alive && setBuilt(b),
        (err) => log.error('zona', err),
      );
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [name, withPhotos, list]);

  const tooBig = built && built.bytes > ZONE_LIMITS.bytes;
  const send = () => {
    if (!built) return;
    if (!share.canShareFiles([built.file])) {
      share.downloadFile(built.file);
      toast(t('zona.export.downloaded'), { icon: 'download' });
      onDone();
      return;
    }
    share.shareFiles([built.file]).then((result) => {
      if (result === 'unsupported') share.downloadFile(built.file);
      if (result === 'sandbox') toast(t('core.nav.sandbox'));
      if (result === 'shared' || result === 'unsupported') onDone();
    });
  };
  return html`<div class="stack">
    <${Field} label=${t('zona.export.name')} value=${name} onInput=${setName} max=${ZONE_LIMITS.name} />
    ${photoNotes.length > 0 && html`<${Toggle} label=${t('zona.export.photos', { n: mb(photoSize ?? 0) })}
      checked=${withPhotos} onChange=${setWithPhotos} />`}
    ${withPhotos && html`<div class="chips">
      ${photoNotes.map((n) => html`<${Thumb} key=${n.photoId} mediaId=${n.photoId} size=${72} />`)}
    </div>`}
    <p class="t-caption t-muted">${t('zona.legal.beforeExport', { n: built?.count ?? list.length })}</p>
    ${tooBig && html`<${Banner} tone="danger" icon="triangle-alert" text=${t('zona.err.tooBig')} />`}
    <${Button} size="xl" block icon="share-2" label=${built ? t('zona.export.send') : t('core.state.preparing')}
      disabled=${!built || tooBig} onClick=${send} />
  </div>`;
}

function PreviewStep({ preview, onDone }) {
  const { plan, zone, rejected } = preview;
  const count = plan.add.length + plan.update.length;
  const apply = useAction(async () => {
    const done = await applyZoneImport(preview);
    cues.playCue('saved');
    undoToast(done.id, done.count);
    onDone();
  });
  const parts = [
    [plan.add.length, 'zona.count.new'], [plan.update.length, 'zona.count.updated'],
    [plan.same.length + plan.duplicate.length, 'zona.count.present'], [plan.edited.length, 'zona.count.edited'],
    [rejected.length, 'zona.count.rejected'],
  ].filter(([n]) => n > 0).map(([n, key]) => tn(/** @type {string} */ (key), /** @type {number} */ (n)));
  const rows = [...plan.add, ...plan.update];
  return html`<div class="stack">
    <${Card} title=${zone.name} icon="map">
      ${zone.exportedAt > 0 && html`<p class="t-body-m t-muted">${format.dateLong(zone.exportedAt)}</p>`}
      <p class="t-body-m">${parts.length ? parts.join(' · ') : t('zona.import.nothing')}</p>
    <//>
    ${rows.length > 0 && html`<${List} label=${zone.name}>
      ${rows.slice(0, PREVIEW_ROWS).map((n) => html`<${ListRow} key=${n.id} icon=${category(n.cat).icon}
        tone=${category(n.cat).tone} title=${n.text || t(catLabelKey(n.cat))} sub=${t(catLabelKey(n.cat))} />`)}
    <//>`}
    ${rows.length > PREVIEW_ROWS && html`<p class="t-caption t-muted">${t('zona.import.more', { n: rows.length - PREVIEW_ROWS })}</p>`}
    <${Banner} tone="neutral" icon="info" text=${t('zona.legal.import')} />
    <${Button} size="xl" block icon="download" label=${tn('zona.import.button', count)} disabled=${count === 0}
      busy=${apply.busy} onClick=${apply.run} />
  </div>`;
}

/** @param {{query?:Record<string,string>}} props */
export default function ZonaScreen({ query }) {
  useLang();
  // "Ho ricevuto una zona" (onboarding) opens /zona?importa=1: the import comes first.
  const [importFirst] = useState(query?.importa === '1');
  const [step, setStep] = useState(/** @type {'home'|'select'|'send'|'preview'} */ ('home'));
  const [picked, setPicked] = useState(() => new Set());
  const [preview, setPreview] = useState(/** @type {any} */ (null));
  const [sendList, setSendList] = useState(/** @type {any[]} */ ([]));
  const input = useRef(/** @type {HTMLInputElement|null} */ (null));
  const { data: list } = useLive(['notes'], listExportable, []);
  const { data: last } = useLive(['imports', 'notes'], () => lastImport(), []);

  const startExport = () => {
    setPicked(new Set((list ?? []).map((n) => n.id)));
    setStep('select');
  };
  const pickFile = useAction(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const r = await previewZoneFile(file);
    if (!r.ok) throw new AppError(`zone-${r.reason}`, REASON_KEYS[r.reason] ?? 'zona.err.notZone');
    setPreview(r);
    setStep('preview');
  });
  const undo = useAction(async () => {
    if (!last) return;
    toast(tn('zona.undo.done', await undoImport(last.id)));
  });
  useEffect(() => {
    if (!importFirst) return;
    // The picker opens where the tap that led here still counts as a user action; where the browser
    // refuses, the highlighted "Importa file" tile is one tap away. The flag leaves the address, so
    // coming back to this screen does not ask for a file again.
    router.navigate('/zona', { replace: true });
    input.current?.click();
  }, []);
  const home = () => setStep('home');
  const titles ={ home: 'zona.title', select: 'zona.export.title', send: 'zona.export.title', preview: 'zona.import.title' };

  return html`<${Screen} title=${t(titles[step])} back="/altro"
    action=${step !== 'home' && html`<${Button} variant="ghost" label=${t('core.action.cancel')} onClick=${home} />`}>
    ${step === 'home' && html`<div class="stack stack--lg">
      <${Art} name="path" />
      <${Tiles}>
        <${Tile} icon="upload" label=${t('zona.export.tile')} primary=${!importFirst} onClick=${startExport} />
        <${Tile} icon="download" label=${t('zona.import.tile')} primary=${importFirst}
          onClick=${() => input.current?.click()} />
      <//>
      <input type="file" accept=".txt,text/plain" hidden ref=${input} onChange=${pickFile.run}
        aria-label=${t('zona.import.tile')} />
      ${last && html`<${Card} title=${tn('zona.last', last.addedIds.length + (last.updated ?? 0))} icon="undo-2"
        action=${{ label: t('core.action.undo'), onClick: undo.run }}>
        <p class="t-body-m t-muted">${last.packName} · ${format.ago(last.at, clock.now())}</p>
      <//>`}
      <p class="t-body-m t-muted">${t('zona.help')}</p>
      <${Button} variant="ghost" block icon="map-pin" label=${t('zona.seeNotes')} onClick=${() => router.navigate('/note')} />
    </div>`}
    ${step === 'select' && html`<${SelectStep} list=${list ?? []} picked=${picked} setPicked=${setPicked}
      onNext=${() => {
        setSendList((list ?? []).filter((n) => picked.has(n.id)));
        setStep('send');
      }} />`}
    ${step === 'send' && html`<${SendStep} list=${sendList} onDone=${home} />`}
    ${step === 'preview' && preview && html`<${PreviewStep} preview=${preview} onDone=${home} />`}
  <//>`;
}
