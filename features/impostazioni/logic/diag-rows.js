// @ts-check
// The built-in rows of Diagnostica (SPEC 3.2): one "Prova" per platform risk. Every `run` is called
// directly inside the tap, so whatever needs the user activation starts before its first await.
// No row prints a position or a note text.
import {
  t, config, clock, env, db, store, settings, i18n, log, geo, wake, cues, speech, gateway, share, camera,
  photo, swClient,
} from '../../../core/api.js';
import { hostsFromCsp, classifyHosts, megabytes } from './diagnostics.js';

/** @typedef {{ok:boolean|null, text:string}} DiagResult */
/** @typedef {{id:string, labelKey:string, hintKey?:string, manual?:boolean, links?:boolean,
 *   run?:() => Promise<DiagResult>|DiagResult}} DiagRow */

const yesNo = (v) => t(v === null ? 'impostazioni.diag.r.unknown' : v ? 'impostazioni.diag.r.yes' : 'impostazioni.diag.r.no');

async function runVersion() {
  const sw = await swClient.version();
  return { ok: null, text: t('impostazioni.diag.r.version', { app: config.APP_VERSION, sw: sw ?? '–' }) };
}

function runInstalled() {
  const ok = env.isStandalone();
  return { ok, text: t(ok ? 'impostazioni.diag.r.installedYes' : 'impostazioni.diag.r.installedNo') };
}

async function runOffline() {
  const ok = await swClient.offlineReady();
  return { ok, text: t(ok ? 'impostazioni.diag.r.offlineYes' : 'impostazioni.diag.r.offlineNo') };
}

async function runStorage() {
  const asked = db.requestPersist();
  let write = false;
  try {
    const key = 'diag.write';
    await db.put('kv', { key, at: clock.now() });
    write = Boolean(await db.get('kv', key));
    await db.del('kv', key);
  } catch (err) {
    log.warn('diag', 'write-failed');
  }
  await asked;
  const info = await db.storageInfo();
  // Not persisted is a warning, not a failure: the app works, but the phone may evict the data.
  const ok = write ? (info.persisted === true ? true : null) : false;
  return { ok,
    text: t('impostazioni.diag.r.storage', { persist: yesNo(info.persisted), used: megabytes(info.usage),
      quota: Math.round(megabytes(info.quota)), write: yesNo(write) }) };
}

async function runLocation() {
  const fix = await geo.currentPosition({ timeoutMs: 10000, maxAgeMs: 0 });
  if (!fix) return { ok: false, text: t('impostazioni.diag.r.locationNo') };
  return { ok: fix.acc <= 50, text: t('impostazioni.diag.r.locationOk', { n: Math.round(fix.acc) }) };
}

async function runWake() {
  const mode = await wake.acquire();
  // Outside a shift the lock is only tried, not kept.
  if (!store.getState().shift) wake.release();
  return { ok: mode === 'native', text: t(mode === 'native' ? 'impostazioni.diag.r.wakeYes' : 'impostazioni.diag.r.wakeNo') };
}

function runSound() {
  if (settings.get('sound.level') === 'off') return { ok: null, text: t('impostazioni.diag.r.soundOff') };
  return cues.unlockAudio().then(async () => {
    cues.playCue('alertInfo');
    cues.haptic('alertInfo');
    const ok = await cues.healthCheck();
    return { ok, text: t(ok ? 'impostazioni.diag.r.soundOk' : 'impostazioni.diag.r.soundNo') };
  });
}

function runVoice() {
  speech.unlock();
  if (!settings.get('voice.on')) return { ok: null, text: t('impostazioni.diag.r.voiceOff') };
  const info = speech.voiceInfo(i18n.getLang());
  if (!info) return { ok: false, text: t('impostazioni.diag.r.voiceNo') };
  speech.say(t('core.say.audioOk'));
  return { ok: true, text: t('impostazioni.diag.r.voice', { name: info.name }) };
}

function hasWebgl() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch (err) {
    return false;
  }
}

async function runMap() {
  const gl = hasWebgl();
  if (!gateway.serviceState('tiles').allowed) {
    return { ok: gl ? null : false, text: t('impostazioni.diag.r.mapOff', { gl: yesNo(gl) }) };
  }
  const p = await gateway.probe('tiles');
  if (p.ok && gl) return { ok: true, text: t('impostazioni.diag.r.mapOk', { ms: Math.round(p.ms) }) };
  return { ok: false, text: t('impostazioni.diag.r.mapFail', { gl: yesNo(gl) }) };
}

function runNet() {
  const s = gateway.stats();
  const errorsCount = Object.values(s).reduce((sum, c) => sum + c.errors, 0);
  const urls = typeof performance !== 'undefined' && performance.getEntriesByType
    ? performance.getEntriesByType('resource').map((e) => e.name) : [];
  const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  const hosts = classifyHosts(urls, location.host, hostsFromCsp(meta?.getAttribute('content') ?? ''));
  const lines = [
    t('impostazioni.diag.r.net', { tiles: s.tiles.requests, overpass: s.overpass.requests, local: s.local.requests,
      errors: errorsCount }),
    t('impostazioni.diag.r.netHosts', { list: hosts.known.join(', ') || t('impostazioni.diag.r.netNone') }),
  ];
  if (hosts.unknown.length) lines.push(t('impostazioni.diag.r.netUnknown', { list: hosts.unknown.join(', ') }));
  return { ok: hosts.unknown.length === 0, text: lines.join(' · ') };
}

async function runNearby() {
  if (!gateway.serviceState('overpass').allowed) return { ok: null, text: t('impostazioni.diag.r.nearbyOff') };
  const p = await gateway.probe('overpass');
  return p.ok ? { ok: true, text: t('impostazioni.diag.r.nearbyOk', { ms: Math.round(p.ms) }) }
    : { ok: false, text: t('impostazioni.diag.r.nearbyFail') };
}

function runShare() {
  const ok = share.canShareFiles([share.makeFile('test.txt', 'text/plain', ['ok'])]);
  return { ok: ok ? true : null, text: t(ok ? 'impostazioni.diag.r.shareYes' : 'impostazioni.diag.r.shareNo') };
}

function runPhoto() {
  // The camera opens inside the tap; the picture is measured and thrown away.
  return camera.takePhoto().then(async (file) => {
    if (!file) return { ok: null, text: t('impostazioni.diag.r.photoNone') };
    const out = await photo.processPhoto(file, photo.PHOTO_NOTE);
    const upright = out.h > out.w;
    return { ok: upright, text: t(upright ? 'impostazioni.diag.r.photoOk' : 'impostazioni.diag.r.photoWrong',
      { w: out.w, h: out.h }) };
  });
}

/** @returns {DiagRow[]} in the order of SPEC 3.2 */
export function builtinRows() {
  return [
    { id: 'version', labelKey: 'impostazioni.diag.row.version', run: runVersion },
    { id: 'installed', labelKey: 'impostazioni.diag.row.installed', run: runInstalled },
    { id: 'offline', labelKey: 'impostazioni.diag.row.offline', run: runOffline },
    { id: 'storage', labelKey: 'impostazioni.diag.row.storage', run: runStorage },
    { id: 'location', labelKey: 'impostazioni.diag.row.location', run: runLocation },
    { id: 'wake', labelKey: 'impostazioni.diag.row.wake', run: runWake },
    { id: 'sound', labelKey: 'impostazioni.diag.row.sound', run: runSound },
    { id: 'voice', labelKey: 'impostazioni.diag.row.voice', hintKey: 'impostazioni.diag.hint.voice', run: runVoice },
    { id: 'call', labelKey: 'impostazioni.diag.row.call', hintKey: 'impostazioni.diag.hint.call', manual: true },
    { id: 'music', labelKey: 'impostazioni.diag.row.music', hintKey: 'impostazioni.diag.hint.music', manual: true },
    { id: 'map', labelKey: 'impostazioni.diag.row.map', run: runMap },
    { id: 'net', labelKey: 'impostazioni.diag.row.net', run: runNet },
    { id: 'nearby', labelKey: 'impostazioni.diag.row.nearby', run: runNearby },
    { id: 'share', labelKey: 'impostazioni.diag.row.share', run: runShare },
    { id: 'photo', labelKey: 'impostazioni.diag.row.photo', hintKey: 'impostazioni.diag.hint.photo', run: runPhoto },
    { id: 'links', labelKey: 'impostazioni.diag.row.links', hintKey: 'impostazioni.diag.hint.links', manual: true,
      links: true },
    { id: 'shiftLink', labelKey: 'impostazioni.diag.row.shiftLink', hintKey: 'impostazioni.diag.hint.shiftLink',
      manual: true },
  ];
}

/**
 * Built-in rows, with the rows other features contribute to the `diagnostics` slot: a slot row with
 * the id of a built-in one replaces it (its owner knows better), new ids go to the end.
 * @param {DiagRow[]} builtin @param {any[]} contributed @returns {DiagRow[]}
 */
export function mergeRows(builtin, contributed) {
  const extra = (contributed ?? []).filter((r) => r && typeof r.id === 'string' && typeof r.labelKey === 'string'
    && typeof r.run === 'function');
  const byId = new Map(extra.map((r) => [r.id, r]));
  const known = new Set(builtin.map((r) => r.id));
  return [...builtin.map((r) => byId.get(r.id) ?? r), ...extra.filter((r) => !known.has(r.id))];
}
