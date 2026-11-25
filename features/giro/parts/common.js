// @ts-check
// Small pieces shared by the screens of the route planner.
import { html, useEffect } from '../../../ui/html.js';
import { t, geo, settings, clock, handoff, router } from '../../../core/api.js';
import { useFix, useTick } from '../../../ui/hooks.js';
import { Button, LinkButton, Icon, Tag } from '../../../ui/kit/index.js';
import { category, catLabelKey } from '../../../core/pure/catalog.js';

/** A fix older than this is not "here" any more (outside a shift nobody refreshes it). */
const HERE_MAX_AGE_MS = 120000;
const STALE_FIX_MS = 60000;

/** @typedef {import('../logic/route.js').Stop} Stop */

/**
 * Where the courier is, only while the fix is fresh. Asks for one reading when the screen opens, but
 * never as the first location prompt of the app.
 * @returns {import('../../../core/types.js').Fix|null}
 */
export function useHere() {
  const fix = useFix();
  const now = useTick(60000);
  useEffect(() => {
    const last = geo.lastFix();
    const stale = !last || clock.now() - last.ts > STALE_FIX_MS;
    if (stale && settings.get('locationExplained') === true) geo.currentPosition().catch(() => null);
  }, []);
  return fix && now - fix.ts < HERE_MAX_AGE_MS ? fix : null;
}

/** @param {Stop} stop */
export const stopLabel = (stop) => stop.label || t('giro.stop.point');

/** First line of a note, or its category. @param {{cat:string, text?:string}} note */
export const noteLine = (note) => String(note.text ?? '').split('\n')[0].trim() || t(catLabelKey(note.cat));

/** Where a stop came from, when that says something to the courier. @param {Stop} stop */
export function sourceTags(stop) {
  if (stop.src === 'door') return [{ label: t('giro.src.door'), tone: 'success', icon: 'star' }];
  if (stop.src === 'note') return [{ label: t('giro.src.note'), icon: 'map-pin' }];
  return [];
}

/** @param {{stop:Stop}} props */
export function SourceTags({ stop }) {
  return sourceTags(stop).map((g) => html`<${Tag} ...${g} />`);
}

/**
 * "Vai", exactly as in Vicino: with a remembered navigator it is a real link (one tap, no picker),
 * otherwise it asks which app to open.
 * @param {{dest:{lat:number, lon:number, label?:string}, navApp:string, onAsk:(dest:object)=>void,
 *   size?:'md'|'xl', block?:boolean, variant?:'primary'|'secondary'}} props
 */
export function GoButton({ dest, navApp, onAsk, size, block, variant = 'secondary' }) {
  if (navApp && navApp !== 'ask' && handoff.navApps().includes(/** @type {any} */ (navApp))) {
    return html`<${LinkButton} external variant=${variant} size=${size} block=${block} icon="navigation"
      label=${t('core.action.go')} href=${handoff.navUrl(/** @type {any} */ (navApp), dest.lat, dest.lon)} />`;
  }
  return html`<${Button} variant=${variant} size=${size} block=${block} icon="navigation" label=${t('core.action.go')}
    onClick=${() => onAsk(dest)} />`;
}

/**
 * What the courier already knows at a stop: one line per saved note within 60 m, each a link to it.
 * @param {{notes:{id:string, cat:string, text?:string}[]}} props
 */
export function Known({ notes }) {
  if (!notes || notes.length === 0) return null;
  return html`<ul class="f-giro-known" aria-label=${t('giro.known')}>
    ${notes.map((n) => {
      const c = category(n.cat);
      return html`<li key=${n.id}>
        <a class="f-giro-known__item" data-tone=${c.tone} href=${router.href(`/note/${n.id}`)}>
          <${Icon} name=${c.icon} />
          <span class="f-giro-known__text">${noteLine(n)}</span>
          <${Icon} name="chevron-right" />
        </a>
      </li>`;
    })}
  </ul>`;
}

/** The category icons of the notes at a stop, for one-line rows. */
export function KnownIcons({ notes }) {
  if (!notes || notes.length === 0) return null;
  return html`<span class="f-giro-icons">
    ${notes.map((n) => html`<span key=${n.id} data-tone=${category(n.cat).tone}><${Icon} name=${category(n.cat).icon} /></span>`)}
  </span>`;
}
