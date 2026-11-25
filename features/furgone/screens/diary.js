// @ts-check
// Diario furgone (SPEC 4.11): four guided photos plus extras, each with date, time and position
// burnt in; share (files are ready before the tap); history by day. Photos are never auto-deleted.
import { html, useEffect, useRef, useState } from '../../../ui/html.js';
import {
  Screen, Button, Tile, Tiles, Chip, Chips, Banner, Dialog, Empty, List, ListRow, Sheet, Thumb, PhotoView,
  confirm, toast,
} from '../../../ui/kit/index.js';
import { useLive, useStore, useLang } from '../../../ui/hooks.js';
import {
  t, AppError, clock, format, db, media, geo, photo, camera, share, shifts, settings, cues, log, errors, router,
} from '../../../core/api.js';
import {
  CORNERS, EXTRA, MAX_EXTRA, validateVan, newSession, stampText, photoFileName, nextCorner, extraCount,
  canAddExtra, addPhoto, currentSession, defaultKind, groupByDay, oldPhotos, sessionBytes,
} from '../logic/van.js';

const PAGE = 30;
const mb = (bytes) => format.number(Math.round(bytes / 104857.6) / 10, 1);
const warn = (code) => (err) => {
  log.warn('furgone', code, { code: String(err?.code ?? err?.name ?? '') });
  return [];
};
const showError = (err) => {
  log.error('furgone', err);
  toast(t(errors.toUserKey(err)), { icon: 'triangle-alert' });
};

/**
 * Files of a session, built as soon as its photos are known, so "Invia le foto" only shares.
 * @returns {{files:File[]|null, send:()=>void, open:(i:number)=>void, viewer:any}}
 */
function useSessionShare(session) {
  const cache = useRef(/** @type {Map<string, File>} */ (new Map())).current;
  const [files, setFiles] = useState(/** @type {File[]|null} */ (null));
  const [view, setView] = useState(-1);
  const photos = session?.photos ?? [];
  const key = photos.map((p) => p.mediaId).join(',');
  useEffect(() => {
    if (photos.length === 0) {
      setFiles(null);
      return undefined;
    }
    let alive = true;
    (async () => {
      const out = [];
      for (const p of photos) {
        let file = cache.get(p.mediaId);
        if (!file) {
          const m = await media.getMedia(p.mediaId);
          if (!m) continue;
          file = share.makeFile(photoFileName(p.at), 'image/jpeg', [m.bytes]);
          cache.set(p.mediaId, file);
        }
        out.push(file);
      }
      if (alive) setFiles(out);
    })().catch(showError);
    return () => {
      alive = false;
    };
  }, [key]);

  const send = () => {
    if (!files || files.length === 0) return;
    share.shareFiles(files).then((res) => {
      if (res === 'shared') toast(t('furgone.sent'), { icon: 'check' });
      else if (res === 'sandbox') toast(t('core.nav.sandbox'));
      else if (res === 'unsupported') {
        // No file sharing here: each photo full screen with "Scarica".
        toast(t('furgone.noShare'));
        setView(0);
      }
    }).catch(showError);
  };

  const shown = view >= 0 ? photos[view] : undefined;
  const file = shown ? cache.get(shown.mediaId) : undefined;
  const viewer = shown && html`<${PhotoView} key=${shown.mediaId} mediaId=${shown.mediaId}
    alt=${t('furgone.photoAlt', { label: t(`furgone.label.${shown.label}`) })} onClose=${() => setView(-1)}
    footer=${html`<div class="f-furgone-bar">
      <${Button} block icon="download" label=${t('core.action.download')} disabled=${!file}
        onClick=${() => file && share.downloadFile(file)} />
      ${view < photos.length - 1 && html`<${Button} block variant="secondary" label=${t('furgone.next')}
        onClick=${() => setView(view + 1)} />`}
    </div>`} />`;
  return { files, send, open: setView, viewer };
}

/** @param {{photos:import('../logic/van.js').VanPhoto[], onOpen:(i:number)=>void}} props */
function Thumbs({ photos, onOpen }) {
  return html`<ul class="f-furgone-thumbs" aria-label=${t('furgone.photos')}>
    ${photos.map((p, i) => html`<li key=${p.mediaId}>
      <button type="button" class="f-furgone-thumb" onClick=${() => onOpen(i)}
        aria-label=${t('furgone.photoAlt', { label: t(`furgone.label.${p.label}`) })}>
        <${Thumb} mediaId=${p.mediaId} size=${96} />
      </button>
      <span class="t-caption t-muted">${format.time(p.at)}</span>
    </li>`)}
  </ul>`;
}

function HistorySheet({ session, onClose }) {
  const shareKit = useSessionShare(session);
  const remove = async () => {
    const ok = await confirm({ icon: 'trash-2', danger: true, title: t('furgone.deleteTitle'),
      text: t('furgone.deleteText'), confirm: t('core.action.delete'), cancel: t('furgone.deleteKeep') });
    if (!ok) return;
    // One transaction: no diary record is left pointing at deleted photos.
    await db.tx(['media', 'van'], 'rw', async (tx) => {
      for (const p of session.photos) await tx.del('media', p.mediaId);
      await tx.del('van', session.id);
    });
    toast(t('furgone.deleted'));
    onClose();
  };
  return html`<${Sheet} open onClose=${onClose}
    title=${`${format.dateShort(session.at)} · ${t(`furgone.session.${session.kind}`)}`}
    footer=${html`
      <${Button} block icon="share-2" label=${t('furgone.send')} disabled=${!shareKit.files}
        busy=${!shareKit.files} onClick=${shareKit.send} />
      <${Button} block variant="ghost" icon="trash-2" label=${t('furgone.delete')}
        onClick=${() => remove().catch(showError)} />`}>
    <${Thumbs} photos=${session.photos} onOpen=${shareKit.open} />
    <p class="t-caption t-muted">${t('furgone.notProof')}</p>
    ${shareKit.viewer}
  <//>`;
}

export default function VanDiary() {
  useLang();
  const shift = useStore((s) => s.shift);
  const [picked, setPicked] = useState(/** @type {'start'|'end'|null} */ (null));
  const [busy, setBusy] = useState(/** @type {string|null} */ (null));
  const [ask, setAsk] = useState(/** @type {string|null} */ (null));
  const [openId, setOpenId] = useState(/** @type {string|null} */ (null));
  const [limit, setLimit] = useState(PAGE);
  const [lastEndedAt, setLastEndedAt] = useState(/** @type {number|null} */ (null));

  const live = useLive(['van'], () => db.getAll('van').then(
    (list) => list.map(validateVan).filter(Boolean), warn('read-failed')));
  /** @type {import('../logic/van.js').VanSession[]} */
  const sessions = /** @type {any} */ (live.data ?? []);

  useEffect(() => {
    const now = clock.now();
    shifts.listShifts({ from: now - 86400000, to: now }).then((list) => {
      const ends = list.map((s) => s.endAt).filter((v) => typeof v === 'number');
      if (ends.length) setLastEndedAt(Math.max(...ends));
    }, warn('shifts-failed'));
  }, []);

  const now = clock.now();
  const kind = picked ?? defaultKind({ shift, lastEndedAt, now });
  const current = currentSession(sessions, kind, shift?.id ?? null, now);
  const photos = current?.photos ?? [];
  const next = nextCorner(photos);
  const shareKit = useSessionShare(current);
  const old = oldPhotos(sessions, now);
  const days = groupByDay(sessions);
  const opened = openId ? sessions.find((s) => s.id === openId) : undefined;

  const shootNow = (label) => {
    const at0 = clock.now();
    const base = current ?? newSession({ id: crypto.randomUUID(), kind, shiftId: shift?.id ?? null, at: at0 });
    // The diary record is written before the camera opens: the page may be closed while it is up.
    const stored = current ? Promise.resolve() : db.put('van', base);
    const shot = camera.takePhoto();
    const where = geo.currentPosition({ timeoutMs: 6000, maxAgeMs: 30000 });
    setBusy(label);
    Promise.all([shot, stored]).then(async ([file]) => {
      if (!file) return;
      const at = clock.now();
      const fix = await where;
      const stamp = stampText({ at, lat: fix?.lat, lon: fix?.lon, acc: fix?.acc, label: t(`furgone.label.${label}`),
        noPosition: t('furgone.noPosition') });
      const out = await photo.processPhoto(file, { ...photo.PHOTO_VAN, stamp });
      const mediaId = crypto.randomUUID();
      // One transaction: a photo is never stored without its diary record, nor the record without it.
      const rec = await db.tx(['media', 'van'], 'rw', async (tx) => {
        const latest = validateVan(await tx.get('van', base.id)) ?? base;
        const res = addPhoto(latest, { label, mediaId, bytes: out.bytes.byteLength, at }, fix);
        const next = validateVan(res.session);
        if (!next || res.session === latest) throw new AppError('van-invalid', 'core.err.save');
        await tx.put('media', { id: mediaId, kind: 'van', mime: out.mime, bytes: out.bytes, w: out.w, h: out.h,
          createdAt: at });
        await tx.put('van', next);
        if (res.replaced) await tx.del('media', res.replaced);
        return next;
      });
      cues.playCue('saved');
      cues.haptic('saved');
      toast(t(nextCorner(rec.photos) === null && label !== EXTRA ? 'furgone.allDone' : 'furgone.saved'), { icon: 'check' });
    }).catch(showError).then(() => setBusy(null));
  };
  const shoot = (label) => () => {
    if (busy) return;
    // Legal notice 14, once: its "Ho capito" is the tap that opens the camera.
    if (!settings.get('firstVanWarned')) setAsk(label);
    else shootNow(label);
  };
  const understood = () => {
    const label = ask;
    setAsk(null);
    settings.set('firstVanWarned', true).catch((err) => log.error('furgone', err));
    if (label) shootNow(label);
  };

  const cornerTile = (c) => {
    const taken = photos.find((p) => p.label === c);
    const value = busy === c ? t('furgone.saving')
      : taken ? t('furgone.tile.done', { time: format.time(taken.at) }) : t('furgone.tile.todo');
    return html`<${Tile} key=${c} icon=${taken ? 'check' : 'camera'} label=${t(`furgone.label.${c}`)} value=${value}
      primary=${!taken && next === c} tone=${taken ? 'success' : undefined} onClick=${shoot(c)} />`;
  };

  return html`<${Screen} title=${t('furgone.title')} back="/altro"
    sticky=${photos.length > 0 && html`
      <${Button} block size="xl" icon="share-2" label=${t('furgone.send')} disabled=${!shareKit.files}
        busy=${!shareKit.files} onClick=${shareKit.send} />
      <${Button} block variant="ghost" label=${t('core.action.done')} onClick=${() => router.back('/altro')} />`}>
    ${old.count > 0 && html`<${Banner} tone="warning" icon="info" text=${t('furgone.old', { n: mb(old.bytes) })} />`}
    <${Chips} label=${t('furgone.kind')}>
      <${Chip} label=${t('furgone.kind.start')} pressed=${kind === 'start'} onToggle=${() => setPicked('start')} />
      <${Chip} label=${t('furgone.kind.end')} pressed=${kind === 'end'} onToggle=${() => setPicked('end')} />
    <//>
    <${Tiles}>
      ${CORNERS.map(cornerTile)}
      <${Tile} wide icon="plus" label=${t('furgone.extra')} onClick=${shoot(EXTRA)}
        value=${busy === EXTRA ? t('furgone.saving') : t('furgone.extraCount', { n: extraCount(photos), max: MAX_EXTRA })}
        disabled=${!canAddExtra(photos)} reason=${t('furgone.limit')} />
    <//>
    ${photos.length > 0 && html`<${Thumbs} photos=${photos} onOpen=${shareKit.open} />`}
    <p class="t-caption t-muted">${t('furgone.notProof')}</p>

    ${days.length === 0 && !live.loading && html`<${Empty} icon="camera" title=${t('furgone.empty.title')}
      text=${t('furgone.empty.text')} />`}
    ${days.length > 0 && html`<h2 class="section-title">${t('furgone.history')}</h2>`}
    ${days.slice(0, limit).map((d) => html`<section class="stack" key=${d.day}>
      <h3 class="t-caption t-muted f-furgone-day">${format.dateLong(d.sessions[0].at)}</h3>
      <${List}>
        ${d.sessions.map((s) => html`<${ListRow} key=${s.id} icon="truck" chevron
          title=${t('furgone.session.title', { kind: t(`furgone.session.${s.kind}`), time: format.time(s.at) })}
          sub=${t('furgone.session.sub', { n: s.photos.length, mb: mb(sessionBytes(s)) })}
          onClick=${() => setOpenId(s.id)} />`)}
      <//>
    </section>`)}
    ${days.length > limit && html`<${Button} block variant="secondary" label=${t('core.action.showMore')}
      onClick=${() => setLimit(limit + PAGE)} />`}

    ${ask && html`<${Dialog} open icon="camera" tone="info" title=${t('furgone.first.title')}
      text=${t('furgone.first.text')}
      actions=${[{ label: t('core.action.understood'), variant: 'primary', onClick: understood }]} />`}
    ${opened && html`<${HistorySheet} key=${opened.id} session=${opened} onClose=${() => setOpenId(null)} />`}
    ${shareKit.viewer}
  <//>`;
}
