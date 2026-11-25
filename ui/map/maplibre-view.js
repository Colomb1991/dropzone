// @ts-check
// The only file that imports vendor/maplibre-gl. Coordinates are [lon, lat] only inside this file.
import { Map as GlMap, Marker, AttributionControl, setWorkerUrl } from '../../vendor/maplibre-gl/maplibre-gl.mjs';
import * as gateway from '../../core/net/gateway.js';
import * as store from '../../core/store.js';
import * as log from '../../core/log.js';
import { now } from '../../core/clock.js';
import { t } from '../../core/i18n.js';
import { AppError } from '../../core/errors.js';

const STYLE_FILE = { light: 'light', dark: 'dark', hc: 'contrast' };
const TONES = ['danger', 'warning', 'info', 'access', 'success', 'neutral'];
const BLOCKED_URL = new URL('../../config/blocked.json', import.meta.url).href;
const EMPTY = { type: 'FeatureCollection', features: [] };
let cssAdded = false;
let workerSet = false;
/** @type {Promise<Document|null>|null} */
let spriteDoc = null;

function addCss() {
  if (cssAdded) return;
  cssAdded = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../vendor/maplibre-gl/maplibre-gl.css', import.meta.url).href;
  document.head.appendChild(link);
}

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888888';

function guard(url) {
  try {
    return gateway.guardMapUrl(url);
  } catch (err) {
    log.warn('map', 'blocked-url');
    return { url: BLOCKED_URL };
  }
}

function loadSprite() {
  spriteDoc ??= gateway.local('assets/icons/sprite.svg', { as: 'text' })
    .then((text) => new DOMParser().parseFromString(String(text), 'image/svg+xml'), () => null);
  return spriteDoc;
}

/** One sprite symbol drawn in a colour, as an image MapLibre can place on a pin. */
async function rasterIcon(name, color) {
  const doc = await loadSprite();
  const sym = doc?.getElementById(`i-${name}`);
  if (!sym) return null;
  const inner = [...sym.childNodes].map((n) => new XMLSerializer().serializeToString(n)).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" `
    + `stroke="${color}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const img = new Image(36, 36);
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  return img;
}

function circlePolygon(lat, lon, radiusM) {
  const ring = [];
  const dLat = radiusM / 111320;
  const dLon = dLat / Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * 2 * Math.PI;
    ring.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

const pinFeature = (p) => ({
  type: 'Feature',
  // `num`: a short text drawn in place of the icon (route stops); `big`: a larger disc.
  properties: { id: p.id, tone: TONES.includes(p.tone) ? p.tone : 'neutral', icon: p.icon, dim: p.dim === true,
    num: p.num ? String(p.num).slice(0, 3) : '', big: p.big === true },
  geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
});

/**
 * @param {HTMLElement} el @param {import('./map.js').MapOptions} opts @param {number} timeoutMs
 * @returns {Promise<import('./map.js').MapHandle>}
 */
export async function createMapLibre(el, opts, timeoutMs) {
  addCss();
  if (!workerSet) {
    setWorkerUrl(new URL('../../vendor/maplibre-gl/maplibre-gl-worker.mjs', import.meta.url).href);
    workerSet = true;
  }
  let theme = opts.theme;
  const loadStyle = (th) => gateway.local(`assets/map-styles/${STYLE_FILE[th] ?? 'dark'}.json`, { as: 'json' });
  const style = await loadStyle(theme);

  const map = new GlMap({
    container: el, style, center: [opts.center.lon, opts.center.lat], zoom: opts.zoom ?? 15,
    minZoom: 5, maxZoom: 19, attributionControl: false, dragRotate: false, pitchWithRotate: false,
    touchPitch: false, fadeDuration: 0, refreshExpiredTiles: false,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    transformRequest: (url) => guard(url),
  });
  map.touchZoomRotate?.disableRotation?.();
  map.addControl(new AttributionControl({ compact: false, customAttribution: t('ui.map.attribution') }), 'bottom-right');

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => fail(new AppError(store.getState().online ? 'map-failed' : 'map-offline',
      'core.map.unavailable')), timeoutMs);
    function fail(err) {
      clearTimeout(timer);
      try {
        map.remove();
      } catch (e) {
        log.warn('map', 'remove-failed');
      }
      reject(err);
    }
    map.once('load', () => {
      clearTimeout(timer);
      resolve(undefined);
    });
    // Before `load`, an error means no style or no WebGL context; after it, single tiles may fail quietly.
    map.once('error', (e) => {
      if (!map.loaded()) fail(new AppError('map-failed', 'core.map.unavailable', { cause: e?.error }));
    });
  });

  /** @type {import('./map.js').MapPin[]} */
  let pins = [];
  let line = null;
  let userFix = null;
  let lastRecentreAt = 0;
  let dead = false;
  const userEl = document.createElement('div');
  userEl.className = 'map-user';
  const userMarker = new Marker({ element: userEl });
  let userShown = false;
  /** @type {Map<string, Promise<void>>} one rasterisation per pin image ('pin-<icon>|<tone>') and style */
  const images = new Map();

  function ensureIcon(id) {
    if (!id.startsWith('pin-')) return Promise.resolve();
    let job = images.get(id);
    if (!job) {
      const [icon, tone] = id.slice(4).split('|');
      job = rasterIcon(icon, cssVar(`--on-tone-${TONES.includes(tone) ? tone : 'neutral'}`)).then((img) => {
        if (img && !dead && !map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 });
      }, () => log.warn('map', 'icon-failed'));
      images.set(id, job);
    }
    return job;
  }
  // A pin can be laid out before its icon has been rasterised: the library waits for this promise
  // instead of drawing the pin without icon and warning about a missing image.
  map.setMissingStyleImageResolver?.((id) => ensureIcon(String(id)));

  async function ensureIcons() {
    const wanted = new Set(pins.filter((p) => !p.num)
      .map((p) => `pin-${p.icon}|${TONES.includes(p.tone) ? p.tone : 'neutral'}`));
    await Promise.all([...wanted].map(ensureIcon));
  }

  function install() {
    if (dead) return;
    images.clear();
    const toneColor = ['match', ['get', 'tone'], ...TONES.flatMap((n) => [n, cssVar(`--tone-${n}`)]), cssVar('--tone-neutral')];
    map.addSource('acc', { type: 'geojson', data: EMPTY });
    map.addSource('line', { type: 'geojson', data: EMPTY });
    const onTone = ['match', ['get', 'tone'], ...TONES.flatMap((n) => [n, cssVar(`--on-tone-${n}`)]),
      cssVar('--on-tone-neutral')];
    const single = ['!', ['has', 'point_count']];
    const numbered = ['!=', ['get', 'num'], ''];
    // A numbered route is read pin by pin: its screen asks for no clustering.
    map.addSource('pins', { type: 'geojson', data: EMPTY, cluster: opts.cluster !== false, clusterRadius: 40,
      clusterMaxZoom: 16 });
    map.addLayer({ id: 'acc', type: 'fill', source: 'acc',
      paint: { 'fill-color': cssVar('--tone-info'), 'fill-opacity': 0.15 } });
    map.addLayer({ id: 'line', type: 'line', source: 'line', layout: { 'line-cap': 'round' },
      paint: { 'line-color': cssVar('--text'), 'line-width': 4, 'line-dasharray': [1, 2] } });
    map.addLayer({ id: 'clusters', type: 'circle', source: 'pins', filter: ['has', 'point_count'],
      paint: { 'circle-radius': 18, 'circle-color': cssVar('--primary'), 'circle-stroke-width': 2,
        'circle-stroke-color': cssVar('--pin-ring') } });
    map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'pins', filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 14,
        'text-allow-overlap': true },
      paint: { 'text-color': cssVar('--on-primary') } });
    map.addLayer({ id: 'pins', type: 'circle', source: 'pins', filter: single,
      paint: { 'circle-radius': ['case', ['get', 'big'], 20, 14], 'circle-color': toneColor, 'circle-stroke-width': 2,
        'circle-stroke-color': cssVar('--pin-ring'), 'circle-opacity': ['case', ['get', 'dim'], 0.45, 1],
        'circle-stroke-opacity': ['case', ['get', 'dim'], 0.45, 1] } });
    map.addLayer({ id: 'pin-icons', type: 'symbol', source: 'pins', filter: ['all', single, ['!', numbered]],
      layout: { 'icon-image': ['concat', 'pin-', ['get', 'icon'], '|', ['get', 'tone']], 'icon-size': 1,
        'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-opacity': ['case', ['get', 'dim'], 0.45, 1] } });
    map.addLayer({ id: 'pin-nums', type: 'symbol', source: 'pins', filter: ['all', single, numbered],
      layout: { 'text-field': ['get', 'num'], 'text-font': ['Noto Sans Bold'],
        'text-size': ['case', ['get', 'big'], 18, 14], 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': onTone, 'text-opacity': ['case', ['get', 'dim'], 0.45, 1] } });
    draw();
  }

  function draw() {
    if (dead || !map.getSource('pins')) return;
    map.getSource('pins').setData({ type: 'FeatureCollection', features: pins.map(pinFeature) });
    map.getSource('line').setData(line
      ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } } : EMPTY);
    map.getSource('acc').setData(userFix ? circlePolygon(userFix.lat, userFix.lon, userFix.acc) : EMPTY);
    ensureIcons();
  }

  map.on('click', 'pins', (e) => {
    const id = e.features?.[0]?.properties?.id;
    if (id && opts.onPinTap) opts.onPinTap(String(id));
  });
  map.on('click', 'clusters', (e) => {
    map.easeTo({ center: e.lngLat, zoom: Math.min(19, map.getZoom() + 2) });
  });

  // Long press: 600 ms hold with under 10 px of movement.
  let pressTimer = null;
  let pressAt = null;
  const cancelPress = () => {
    clearTimeout(pressTimer);
    pressTimer = null;
    pressAt = null;
  };
  const startPress = (e) => {
    cancelPress();
    if (!opts.onLongPress || (e.originalEvent?.touches?.length ?? 1) > 1) return;
    pressAt = e.point;
    const at = e.lngLat;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      opts.onLongPress?.({ lat: at.lat, lon: at.lng });
    }, 600);
  };
  const movePress = (e) => {
    if (pressAt && Math.hypot(e.point.x - pressAt.x, e.point.y - pressAt.y) > 10) cancelPress();
  };
  map.on('mousedown', startPress);
  map.on('touchstart', startPress);
  map.on('mousemove', movePress);
  map.on('touchmove', movePress);
  for (const name of ['mouseup', 'touchend', 'touchcancel', 'dragstart', 'zoomstart']) map.on(name, cancelPress);

  install();

  return {
    kind: 'maplibre',
    setPins(next) {
      pins = next ?? [];
      draw();
    },
    setLine(a, b) {
      line = a && b ? [[a[1], a[0]], [b[1], b[0]]] : null;
      draw();
    },
    setUser(fix) {
      userFix = fix;
      if (dead) return;
      if (!fix) {
        if (userShown) userMarker.remove();
        userShown = false;
      } else {
        userMarker.setLngLat([fix.lon, fix.lat]);
        if (!userShown) userMarker.addTo(map);
        userShown = true;
        if (opts.follow) {
          // Recentre only when the dot leaves the middle 60 % of the view, at most every 3 s, no animation.
          const p = map.project([fix.lon, fix.lat]);
          const box = map.getContainer().getBoundingClientRect();
          const out = p.x < box.width * 0.2 || p.x > box.width * 0.8 || p.y < box.height * 0.2 || p.y > box.height * 0.8;
          if (out && now() - lastRecentreAt >= 3000) {
            lastRecentreAt = now();
            map.jumpTo({ center: [fix.lon, fix.lat] });
          }
        }
      }
      draw();
    },
    flyTo(lat, lon, zoom) {
      if (!dead) map.jumpTo({ center: [lon, lat], zoom: zoom ?? map.getZoom() });
    },
    getCenter() {
      const c = map.getCenter();
      return { lat: c.lat, lon: c.lng };
    },
    setTheme(next) {
      if (dead || next === theme) return;
      theme = next;
      loadStyle(next).then((s) => {
        if (dead) return;
        map.once('style.load', install);
        map.setStyle(s, { diff: false });
      }, (err) => log.error('map', err));
    },
    resize() {
      if (!dead) map.resize();
    },
    destroy() {
      if (dead) return;
      dead = true;
      cancelPress();
      try {
        map.remove();
      } catch (err) {
        log.warn('map', 'remove-failed');
      }
    },
  };
}
