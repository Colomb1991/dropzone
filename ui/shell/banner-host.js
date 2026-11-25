// @ts-check
// Shows one banner, picked by the priority of SPEC 3.1.
import { html, useEffect, useState } from '../html.js';
import * as store from '../../core/store.js';
import * as db from '../../core/db/db.js';
import * as geo from '../../core/geo/geo.js';
import * as wake from '../../core/platform/wake.js';
import * as session from '../../core/shift/session.js';
import * as sandbox from '../../core/sandbox.js';
import * as backup from '../../core/data/backup.js';
import * as settings from '../../core/settings.js';
import * as router from '../../core/router.js';
import * as log from '../../core/log.js';
import { now } from '../../core/clock.js';
import { t, tn } from '../../core/i18n.js';
import { useStore, useTick } from '../hooks.js';
import { Banner } from '../kit/banner.js';
import { LocationHelp } from './location-help.js';

const WEEK_MS = 7 * 86400000;
/** Nudges the user closed: id → epoch ms. Kept in the `kv` store so they return after 7 days. */
const dismissed = { storage: 0, backup: 0 };
let dismissedLoaded = false;
/** @type {Set<() => void>} */
const pulseListeners = new Set();

/** The moving lock calls this when the driver taps a locked area. */
export function pulseBanner() {
  pulseListeners.forEach((fn) => fn());
}

async function loadDismissed() {
  if (dismissedLoaded) return;
  dismissedLoaded = true;
  for (const id of Object.keys(dismissed)) {
    const rec = await db.get('kv', `ui.banner.${id}`).catch(() => null);
    if (rec && typeof rec.at === 'number') dismissed[id] = rec.at;
  }
}

function dismiss(id) {
  dismissed[id] = now();
  db.put('kv', { key: `ui.banner.${id}`, at: dismissed[id] }).catch((err) => log.error('banner', err));
}

let locationAsked = 0;

/** Screens that use the position: Turno home, Note, Vicino, Segnala, SOS. */
const LOCATION_PATHS = ['/note', '/vicino', '/segnala', '/sos'];

/** "Posizione spenta" shows only where the position matters, not on settings, hours or diagnostics. */
export function needsLocation(path) {
  return path === '/' || LOCATION_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * @param {import('../../core/types.js').AppState} s
 * @param {{onLocationHelp:()=>void, refresh:()=>void, path?:string}} ctx `path`: the route on screen
 * @returns {{id:string, tone:string, icon:string, text:string, action?:{label:string, onClick:()=>void},
 *   onDismiss?:()=>void}|null}
 */
export function pickBanner(s, ctx) {
  const inShift = s.shift !== null;
  const moving = s.moving && !s.passenger;
  if (inShift && !moving && s.audio === 'locked') {
    return { id: 'audio', tone: 'warning', icon: 'volume-x', text: t('core.banner.audioLocked'),
      action: { label: t('core.banner.rearm'), onClick: () => session.rearmAudio() } };
  }
  if (moving) return { id: 'moving', tone: 'info', icon: 'car', text: t('core.banner.moving') };
  if (s.gps.state === 'denied' && (ctx.path === undefined || needsLocation(ctx.path))) {
    return { id: 'location', tone: 'warning', icon: 'locate-fixed', text: t('core.banner.locationOff'),
      action: { label: t('core.action.activate'), onClick: () => {
        // The browser asks again only while the answer is still open; after that, explain where to go.
        if (++locationAsked > 1) ctx.onLocationHelp();
        else if (s.shift?.mode === 'holder') geo.start();
        else geo.currentPosition().catch(() => ctx.onLocationHelp());
      } } };
  }
  if (inShift && s.shift?.mode === 'holder' && s.wake === 'none') {
    return { id: 'wake', tone: 'warning', icon: 'info', text: t('core.banner.screenSleep'),
      action: { label: t('core.action.retry'), onClick: () => {
        wake.acquire().catch((err) => log.error('wake', err));
      } } };
  }
  if (s.gps.state === 'coarse') return { id: 'gps', tone: 'warning', icon: 'locate-fixed', text: t('core.banner.coarse') };
  if (s.gps.state === 'imprecise') {
    return { id: 'gps', tone: 'warning', icon: 'locate-fixed', text: t('core.banner.imprecise', { n: s.gps.acc ?? 0 }) };
  }
  if (inShift && (s.gps.state === 'unavailable' || s.gps.state === 'paused')) {
    return { id: 'gps', tone: 'warning', icon: 'locate-fixed', text: t('core.banner.gpsLost') };
  }
  if (!s.primary) return { id: 'window', tone: 'warning', icon: 'info', text: t('core.banner.secondWindow') };
  if (!s.online) return { id: 'offline', tone: 'neutral', icon: 'wifi-off', text: t('core.banner.offline') };
  if (s.sandbox) {
    return { id: 'demo', tone: 'access', icon: 'flask-conical', text: t('core.banner.demo'),
      action: { label: t('core.action.exit'), onClick: () => sandbox.exit() } };
  }
  const at = now();
  if (s.storage.pct >= 80 && at - dismissed.storage > WEEK_MS) {
    return { id: 'storage', tone: 'warning', icon: 'info', text: t('core.banner.storage'),
      onDismiss: () => {
        dismiss('storage');
        ctx.refresh();
      } };
  }
  if (!inShift && backup.backupDue() && at - dismissed.backup > WEEK_MS) {
    const since = settings.get('lastBackupAt') ?? settings.get('onboardedAt') ?? at;
    return { id: 'backup', tone: 'info', icon: 'download',
      text: tn('core.banner.backup', Math.max(1, Math.floor((at - since) / 86400000))),
      action: { label: t('ui.banner.export'), onClick: () => router.navigate('/impostazioni/backup') },
      onDismiss: () => {
        dismiss('backup');
        ctx.refresh();
      } };
  }
  return null;
}

/** Rendered by the kit `Screen`, under the header. */
export function BannerHost() {
  const s = useStore((x) => x);
  useTick(60000);
  const [, bump] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [help, setHelp] = useState(false);
  const refresh = () => bump((n) => n + 1);
  useEffect(() => {
    loadDismissed().then(refresh);
    let timer = null;
    const fn = () => {
      setPulse(true);
      clearTimeout(timer);
      timer = setTimeout(() => setPulse(false), 500);
    };
    pulseListeners.add(fn);
    const off = store.subscribe((x) => x.shift, () => {
      locationAsked = 0;
    });
    return () => {
      pulseListeners.delete(fn);
      clearTimeout(timer);
      off();
    };
  }, []);
  const b = pickBanner(s, { onLocationHelp: () => setHelp(true), refresh, path: router.current().path });
  return html`
    ${b && html`<${Banner} key=${b.id} tone=${b.tone} icon=${b.icon} text=${b.text} action=${b.action}
      onDismiss=${b.onDismiss} pulse=${pulse && b.id === 'moving'} />`}
    ${help && html`<${LocationHelp} onClose=${() => setHelp(false)} />`}`;
}
