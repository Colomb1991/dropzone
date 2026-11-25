// @ts-check
import { html, useEffect, useRef, useState } from '../html.js';
import * as events from '../../core/events.js';
import * as router from '../../core/router.js';
import * as log from '../../core/log.js';
import { t } from '../../core/i18n.js';
import { useStore, useFix, useSetting } from '../hooks.js';
import { createMap } from '../map/map.js';
import { Icon } from './icon.js';
import { Button } from './button.js';

/**
 * A map that exists only while it is on screen. When it cannot start, the notice and `fallback`
 * (the screen's list) are shown instead.
 * @param {{center:{lat:number, lon:number}, zoom?:number, pins:import('../map/map.js').MapPin[],
 *   user?:boolean, line?:[[number,number],[number,number]]|null, crosshair?:boolean,
 *   onLongPress?:(p:{lat:number, lon:number})=>void, onPinTap?:(id:string)=>void,
 *   onReady?:(m:import('../map/map.js').MapHandle)=>void, fallback:any, follow?:boolean,
 *   cluster?:boolean}} props  `follow`: keep the user in view (default: same as `user`);
 *   `cluster`: false shows every pin on its own (default true)
 */
export function MapView(props) {
  const { center, zoom, pins, user, line, crosshair, fallback } = props;
  const el = useRef(/** @type {HTMLElement|null} */ (null));
  const handle = useRef(/** @type {import('../map/map.js').MapHandle|null} */ (null));
  const live = useRef(props);
  live.current = props;
  const view = useRef({ center, zoom });
  const theme = useStore((s) => s.theme);
  const [tilesOn] = useSetting('svc.tiles');
  const fix = useFix();
  const [visible, setVisible] = useState(typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const [state, setState] = useState(/** @type {'loading'|'ready'|'off'|'failed'} */ ('loading'));

  useEffect(() => {
    const offV = events.on('app:visible', () => setVisible(true));
    const offH = events.on('app:hidden', () => setVisible(false));
    return () => {
      offV();
      offH();
    };
  }, []);

  useEffect(() => {
    if (!visible || !el.current) return undefined;
    let dead = false;
    setState('loading');
    createMap(el.current, {
      center: view.current.center, zoom: view.current.zoom, theme,
      follow: live.current.follow ?? Boolean(user), cluster: live.current.cluster !== false,
      onLongPress: (p) => live.current.onLongPress?.(p),
      onPinTap: (id) => live.current.onPinTap?.(id),
    }).then((m) => {
      if (dead) {
        m.destroy();
        return;
      }
      handle.current = m;
      m.setPins(live.current.pins ?? []);
      setState('ready');
      live.current.onReady?.(m);
    }, (err) => {
      log.warn('map', String(err?.code ?? 'map-failed'));
      if (!dead) setState(err?.code === 'map-off' ? 'off' : 'failed');
    });
    return () => {
      dead = true;
      const m = handle.current;
      handle.current = null;
      if (m) {
        // Keep the place the user was looking at for when the page comes back.
        view.current = { center: m.getCenter(), zoom: view.current.zoom };
        m.destroy();
      }
    };
  }, [visible, tilesOn]);

  useEffect(() => {
    if (state === 'ready') handle.current?.setPins(pins ?? []);
  }, [pins, state]);
  useEffect(() => {
    if (state === 'ready') handle.current?.setTheme(theme);
  }, [theme, state]);
  useEffect(() => {
    if (state === 'ready' && user) handle.current?.setUser(fix);
  }, [fix, user, state]);
  useEffect(() => {
    if (state !== 'ready') return;
    if (line) handle.current?.setLine(line[0], line[1]);
    else handle.current?.setLine(null);
  }, [line, state]);

  const down = state === 'off' || state === 'failed';
  // The canvas element stays mounted (hidden) so the map can start again when the setting changes.
  return html`<div class="stack">
    ${down && html`<div class="map__notice">
      <p class="t-body-m t-muted">${t(state === 'off' ? 'core.map.off' : 'core.map.unavailable')}</p>
      ${state === 'off' && html`<${Button} variant="secondary" icon="settings" label=${t('core.action.openSettings')}
        onClick=${() => router.navigate('/impostazioni')} />`}
    </div>`}
    <div class="map" hidden=${down}>
      <div class="map__canvas" ref=${el}></div>
      ${state === 'loading' && html`<div class="map__status">${t('core.state.loading')}</div>`}
      ${crosshair && state === 'ready' && html`<span class="map__crosshair"><${Icon} name="crosshair" size=${32} /></span>`}
    </div>
    ${down && fallback}
  </div>`;
}
