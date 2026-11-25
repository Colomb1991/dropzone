// @ts-check
// Repository of the `alerts` store, the proximity source `alert` and the map pins.
import { db, clock, env, events, format, geo, i18n, t, tick, proximity, log } from '../../core/api.js';
import { alertType, alertTypeKey, ALERT_RADIUS_M } from '../../core/pure/catalog.js';
import { validateAlert, buildMessage, KEEP_AFTER_EXPIRY_MS } from './logic/message.js';
import { buildAlertUrl, fitAlertText, alertId } from './logic/alert-link.js';

const STORE = 'alerts';

/** @typedef {{id:string, type:number, lat:number, lon:number, createdAt:number, expiresAt:number, text:string,
 *   origin:'mine'|'received', fired:boolean}} Alert */

/** Position and time captured by the "Segnala" button of the home, used by the next type tile. */
let captured = /** @type {{lat:number, lon:number, at:number}|null} */ (null);
export function setCaptured(c) {
  captured = c;
}
export function takeCaptured() {
  const c = captured && clock.now() - captured.at < 120000 ? captured : null;
  captured = null;
  return c;
}

export const FRESH_FIX_MS = 10000;
/** The last fix, only while it is fresh: outside a shift, or with the phone in a pocket, it can be hours old. */
export function freshFix(now = clock.now()) {
  const fix = geo.lastFix();
  return fix && now - fix.ts <= FRESH_FIX_MS ? fix : null;
}

/** Not expired, newest first. @returns {Promise<Alert[]>} */
export async function listActive(now = clock.now()) {
  /** @type {Alert[]} */
  const all = await db.getAll(STORE);
  return all.filter((a) => a.expiresAt > now).sort((a, b) => b.createdAt - a.createdAt);
}

/** Own alert at a position; it never fires for its author. @returns {Promise<Alert>} */
export async function createAlert({ type, lat, lon, at }) {
  const createdAt = Math.floor(at / 60000) * 60000;
  const place = { lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 };
  const rec = validateAlert({
    // The id of its own link: the author who opens it does not get a second copy that alerts them.
    id: alertId({ type, ...place, createdAt }), type, ...place,
    createdAt, expiresAt: createdAt + alertType(type).ttlMin * 60000, text: '', origin: 'mine', fired: true,
  });
  if (!rec) throw new Error('alert-invalid');
  await db.put(STORE, rec);
  return /** @type {Alert} */ (rec);
}

/** @param {string} id @param {Partial<Alert>} patch */
export function patchAlert(id, patch) {
  return db.tx([STORE], 'rw', async (tx) => {
    const cur = await tx.get(STORE, id);
    const next = cur && validateAlert({ ...cur, ...patch, id });
    if (next) await tx.put(STORE, next);
    return next;
  });
}

/** From a decoded link. The same link twice is one record. @returns {Promise<'added'|'present'>} */
export function addReceived(alert) {
  return db.tx([STORE], 'rw', async (tx) => {
    if (await tx.get(STORE, alert.id)) return 'present';
    const rec = validateAlert({ ...alert, origin: 'received', fired: false });
    if (!rec) throw new Error('alert-invalid');
    await tx.put(STORE, rec);
    return 'added';
  });
}

export function removeAlert(id) {
  return db.del(STORE, id);
}

/** Received and own alerts are deleted 24 h after their expiry. */
export async function purge(now = clock.now()) {
  const all = await db.getAll(STORE);
  for (const a of all) if (a.expiresAt + KEEP_AFTER_EXPIRY_MS < now) await db.del(STORE, a.id);
}

/** Parts of the message and the link for an alert with the detail typed so far. */
export function messageFor(alert, text = alert.text) {
  const payload = { type: alert.type, lat: alert.lat, lon: alert.lon, createdAt: alert.createdAt,
    ttlMin: Math.round((alert.expiresAt - alert.createdAt) / 60000), text };
  const fitted = fitAlertText(payload, env.appUrl());
  const url = buildAlertUrl({ ...payload, text: fitted }, env.appUrl());
  const message = buildMessage({ typeLabel: t(alertTypeKey(alert.type)), from: format.time(alert.createdAt),
    to: format.time(alert.expiresAt), text: fitted, url }, t);
  return { url, message, fitted };
}

export async function pins(ctx) {
  return (await listActive(ctx?.now ?? clock.now())).map((a) => {
    const type = alertType(a.type);
    // featureId lets the map host open this feature's screen when the pin is tapped.
    return { id: a.id, featureId: 'segnala', lat: a.lat, lon: a.lon, tone: type.tone, icon: type.icon,
      label: t(alertTypeKey(a.type)) };
  });
}

/** Registers the proximity source and the housekeeping tick. @returns {() => void} */
export function startAlerts() {
  let nextExpiry = Infinity;
  /** @type {Map<string, Alert>} */
  let loaded = new Map();
  const off = proximity.registerSource({
    id: 'alert',
    watch: [STORE],
    load: async () => {
      const list = await listActive();
      loaded = new Map(list.map((a) => [a.id, a]));
      nextExpiry = Math.min(Infinity, ...list.map((a) => a.expiresAt));
      return list.map((a) => ({
        id: a.id, source: 'alert', lat: a.lat, lon: a.lon, cls: /** @type {'approach'} */ ('approach'),
        fixedRadiusM: ALERT_RADIUS_M, tone: alertType(a.type).tone, output: /** @type {'voice'} */ ('voice'),
        schedule: null, cooldown: /** @type {'once'} */ ('once'), lastFiredAt: a.fired ? a.createdAt : null,
        mutedUntil: null,
      }));
    },
    card: async (id, ctx) => {
      const a = loaded.get(id);
      if (!a || a.expiresAt <= ctx.now) return null;
      const type = alertType(a.type);
      const title = t(alertTypeKey(a.type));
      return {
        id, source: 'alert', tone: type.tone, icon: type.icon, title, text: a.text,
        meta: t('segnala.card.meta', { time: format.time(a.expiresAt) }), distM: ctx.distM, photoId: null,
        speakText: a.text ? `${title}. ${a.text}` : `${title}.`, lang: i18n.getLang(),
      };
    },
    onFired: async (id) => {
      await patchAlert(id, { fired: true });
    },
    onMuted: async (id) => {
      await patchAlert(id, { fired: true });
    },
  });
  const offTick = tick.onTick((now) => {
    if (now < nextExpiry) return;
    nextExpiry = Infinity;
    // An expired alert leaves the map and the engine; the record goes 24 h later.
    purge(now).catch((err) => log.error('segnala', err));
    events.emit('data:changed', { store: STORE });
  }, 60000);
  purge().catch((err) => log.error('segnala', err));
  return () => {
    off();
    offTick();
  };
}
