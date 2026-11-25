// @ts-check
// Nota (detail): SPEC 3.2.
import { html, useState } from '../../../ui/html.js';
import { t, notes, router, format, log } from '../../../core/api.js';
import { useLive, useLang, useTick, useAction } from '../../../ui/hooks.js';
import { Screen, Card, Button, LinkButton, Toggle, Tag, Empty, NavigateSheet, PhotoView, Thumb, confirm, toast }
  from '../../../ui/kit/index.js';
import { category, catLabelKey } from '../../../core/pure/catalog.js';
import { isScheduleActive } from '../../../core/pure/schedule.js';
import { distM } from '../../../core/pure/geo-math.js';
import { visitInfo, noteTitle } from '../logic/note-view.js';
import { muteToday } from '../logic/actions.js';
import { VisitButtons, usePlace } from '../components/note-row.js';

/** @param {{params:{id:string}}} props */
export default function NoteDetail({ params }) {
  useLang();
  const id = params.id;
  const now = useTick(60000);
  const place = usePlace();
  const { data: note, loading } = useLive(['notes'], () => notes.getNote(id), [id]);
  const [nav, setNav] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  const setPrivate = useAction((v) => notes.updateNote(id, { private: v }));
  const mute = useAction(() => muteToday(id));
  const remove = useAction(async () => {
    const yes = await confirm({ title: t('note.detail.deleteAsk'), confirm: t('note.detail.deleteYes'),
      cancel: t('note.detail.deleteNo'), danger: true, icon: 'trash-2' });
    if (!yes) return;
    const { undo } = await notes.deleteNote(id);
    toast(t('note.detail.deleted'), { icon: 'trash-2', ms: 8000,
      action: { label: t('core.action.undo'), onClick: () => undo().catch((err) => log.error('note', err)) } });
    router.back('/note');
  });

  if (!note) {
    return html`<${Screen} title=${t('note.title')} back="/note">
      ${loading ? html`<p class="t-body-m t-muted">${t('core.state.loading')}</p>`
        : html`<${Empty} icon="map-pin" title=${t('note.detail.missing')} />`}
    <//>`;
  }
  const c = category(note.cat);
  const label = t(catLabelKey(note.cat));
  const dist = place ? format.distance(distM(place.lat, place.lon, note.lat, note.lon)) : '';
  const visits = visitInfo(note, now, t);
  const active = isScheduleActive(note.schedule, new Date(now));
  const meta = note.origin === 'received'
    ? t(note.packName ? 'note.meta.receivedZone' : 'note.meta.received',
      { date: format.dateShort(note.createdAt), zone: note.packName ?? '' })
    : t('note.meta.mine', { date: format.dateShort(note.createdAt) });

  return html`<${Screen} title=${t('note.title')} back="/note">
    <${Card} tone=${c.tone} icon=${c.icon} title=${label}>
      ${note.text
        ? html`<p class="t-title-l f-note-text">${note.text}</p>`
        : html`<p class="t-body-m t-muted">${t('note.detail.noText')}</p>`}
      ${note.photoId && html`<button type="button" class="f-note-photo" aria-label=${t('core.alert.openPhoto')}
        onClick=${() => setPhotoOpen(true)}><${Thumb} mediaId=${note.photoId} size=${96} /></button>`}
      ${note.schedule && html`<p class="t-body-m">
        ${active ? format.scheduleLabel(note.schedule)
          : t('core.alert.notNow', { when: format.scheduleLabel(note.schedule).toLowerCase() })}
        <br /><span class="t-muted">${t('core.alert.sign')}</span>
      </p>`}
      ${(note.private || visits.closedNow) && html`<div class="cluster">
        ${visits.closedNow && html`<${Tag} tone="warning" label=${t('core.visit.oftenClosed')} />`}
        ${note.private && html`<${Tag} icon="lock" label=${t('core.tag.private')} />`}
      </div>`}
    <//>
    ${note.biz && html`<${Card} icon="store" title=${t('note.detail.visits')}>
      ${visits.lines.map((line) => html`<p class="t-body-m">${line}</p>`)}
      <${VisitButtons} note=${note} />
      <p class="t-caption t-muted">${t('core.visit.hint')}</p>
    <//>`}
    <p class="t-caption t-muted">${dist ? `${meta} · ${dist}` : meta}</p>
    <${Button} block size="xl" icon="navigation" label=${t('core.action.takeMe')} onClick=${() => setNav(true)} />
    <${LinkButton} block variant="secondary" icon="pencil" label=${t('core.action.edit')}
      href=${router.href(`/note/${id}/modifica`)} />
    <${Toggle} label=${t('core.tag.private')} sub=${t('note.detail.privateHelp')} checked=${note.private}
      onChange=${setPrivate.run} />
    <${Button} block variant="secondary" icon="bell-off" label=${t('note.detail.mute')} busy=${mute.busy}
      onClick=${mute.run} />
    <${Button} block variant="ghost" icon="trash-2" label=${t('core.action.delete')} busy=${remove.busy}
      onClick=${remove.run} />
    <${NavigateSheet} open=${nav} dest=${{ lat: note.lat, lon: note.lon, label: noteTitle(note, t) }}
      onClose=${() => setNav(false)} />
    ${photoOpen && note.photoId && html`<${PhotoView} mediaId=${note.photoId} alt=${t('note.detail.photoAlt')}
      onClose=${() => setPhotoOpen(false)} />`}
  <//>`;
}
