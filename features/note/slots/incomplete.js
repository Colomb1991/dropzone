// @ts-check
// Slot home.idle (order 40): "Da completare" → the list with that filter.
import { html } from '../../../ui/html.js';
import { t, tn, notes, router } from '../../../core/api.js';
import { useLang, useLive } from '../../../ui/hooks.js';
import { Card } from '../../../ui/kit/index.js';
import { FILTER_INCOMPLETE } from '../logic/note-view.js';

export default function Incomplete() {
  useLang();
  const { data } = useLive(['notes'], () => notes.listNotes({ incomplete: true }));
  const n = (data ?? []).length;
  if (n === 0) return null;
  return html`<${Card} icon="pencil" title=${t('note.filter.incomplete')}
    href=${router.href('/note', { filtro: FILTER_INCOMPLETE })}>
    <p class="t-body-m">${tn('note.incomplete.count', n)}</p>
  <//>`;
}
