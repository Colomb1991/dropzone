// @ts-check
// Slot shift.tools ("Strumenti", one tap from the shift home): one wide tile. Without a saved point
// a tap saves it; with one, the tile shows how far the van is and opens the screen.
import { html } from '../../../ui/html.js';
import { t, router, format, clock } from '../../../core/api.js';
import { useLive, useLang, useFix, useTick, useAction } from '../../../ui/hooks.js';
import { Tile, toast } from '../../../ui/kit/index.js';
import { loadSpot, saveHere, clearSpot } from '../logic/data.js';
import { distanceM, HERE_M } from '../logic/spot.js';

/** The distance on the tile is shown only from a position this recent. */
const FRESH_FIX_MS = 60000;

/** @param {{onDone?:()=>void}} props `onDone`: closes the sheet the tile sits in, so the toast is seen */
export default function VanTile({ onDone }) {
  useLang();
  useTick(5000);
  const fix = useFix();
  const { data: spot } = useLive(['vanSpot'], loadSpot);
  // The position is asked inside the tap; the toast offers the way back from a wrong tap.
  const save = useAction(async () => {
    const saved = await saveHere();
    if (onDone) onDone();
    toast(t('furgone-qui.saved', { time: format.time(saved.at) }), { icon: 'check',
      action: { label: t('core.action.undo'), onClick: () => clearSpot() } });
  });
  if (spot === undefined) return null;

  let tile;
  if (!spot) {
    tile = html`<${Tile} wide icon="circle-parking" label=${t('furgone-qui.here')}
      value=${t(save.busy ? 'furgone-qui.saving' : 'furgone-qui.tile.hint')} onClick=${save.run} />`;
  } else {
    const d = fix && clock.now() - fix.ts <= FRESH_FIX_MS ? distanceM(spot, fix) : null;
    const label = d === null ? t('furgone-qui.noDist')
      : d <= HERE_M ? t('furgone-qui.atHere') : t('furgone-qui.at', { dist: format.distance(d) });
    tile = html`<${Tile} wide icon="circle-parking" label=${label}
      value=${t('furgone-qui.savedAt', { time: format.time(spot.at) })} href=${router.href('/furgone-qui')} />`;
  }
  return html`<div class="tiles f-furgone-qui-tile">${tile}</div>`;
}
