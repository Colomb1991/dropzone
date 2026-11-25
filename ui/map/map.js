// @ts-check
// Map wrapper: decides whether a map may start at all. MapLibre (1.6 MB) is imported only here,
// dynamically, when a map is really shown.
import * as store from '../../core/store.js';
import * as settings from '../../core/settings.js';
import { AppError } from '../../core/errors.js';

/** @typedef {{id:string, lat:number, lon:number, tone:string, icon:string, label?:string, dim?:boolean,
 *   num?:string|number, big?:boolean}} MapPin  `num`: drawn in place of the icon; `big`: a larger disc */
/** @typedef {{kind:'maplibre',
 *   setUser(fix: import('../../core/types.js').Fix|null): void, setPins(pins: MapPin[]): void,
 *   setLine(a:[number,number]|null, b?:[number,number]): void,
 *   flyTo(lat:number, lon:number, zoom?:number): void, getCenter(): {lat:number, lon:number},
 *   setTheme(theme:'light'|'dark'|'hc'): void, resize(): void, destroy(): void}} MapHandle */
/** @typedef {{center:{lat:number, lon:number}, zoom?:number, theme:'light'|'dark'|'hc', follow?:boolean,
 *   cluster?:boolean, onLongPress?:(p:{lat:number, lon:number})=>void, onPinTap?:(id:string)=>void}} MapOptions
 *   `cluster`: false keeps every pin on its own (numbered route stops); default true */

export const LOAD_TIMEOUT_MS = 8000;

function hasWebGl() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (err) {
    return false;
  }
}

/**
 * Why a map cannot start, or null. Pure enough to test: every input is passed in.
 * @param {{sandbox:boolean, tilesOn:boolean, webgl:boolean}} s
 * @returns {null|'map-off'|'map-webgl'|'map-failed'}
 */
export function mapRefusal(s) {
  if (s.sandbox) return 'map-failed';
  if (!s.tilesOn) return 'map-off';
  if (!s.webgl) return 'map-webgl';
  return null;
}

/**
 * @param {HTMLElement} el @param {MapOptions} opts
 * @returns {Promise<MapHandle>} rejects with AppError 'map-off'|'map-offline'|'map-webgl'|'map-failed'
 */
export async function createMap(el, opts) {
  const no = mapRefusal({
    sandbox: store.getState().sandbox, tilesOn: settings.get('svc.tiles') === true, webgl: hasWebGl(),
  });
  if (no) throw new AppError(no, no === 'map-off' ? 'core.map.off' : 'core.map.unavailable');
  try {
    const view = await import('./maplibre-view.js');
    return await view.createMapLibre(el, opts, LOAD_TIMEOUT_MS);
  } catch (err) {
    if (err instanceof AppError) throw err;
    const code = store.getState().online ? 'map-failed' : 'map-offline';
    throw new AppError(code, 'core.map.unavailable', { cause: err });
  }
}
