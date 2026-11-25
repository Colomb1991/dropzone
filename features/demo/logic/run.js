// @ts-check
// Runs the demo on the real pipeline: sandbox (separate database, shifted clock, simulated GPS,
// network closed), a real shift, the real proximity engine and the real alert card. The two sample
// notes live in the proximity source `demo`, in memory: nothing of the user's data is read or written.
import {
  t, clock, settings, sandbox, geo, session, proximity, presenter, cues, speech, format, i18n,
} from '../../../core/api.js';
import {
  demoTrack, demoClockStart, marketTarget, dogTarget, MARKET_ID, DOG_ID, MARKET_SCHEDULE, RADIUS_M, GPS_ACC_M,
} from './script.js';

/** @type {ReturnType<typeof geo.createSimProvider>|null} */
let provider = null;
/** @type {any[]} */
let targets = [];
let registered = false;

/** The approach card of the market note. Band word = the spoken label (SPEC 3.2). */
function marketCard(distM) {
  const label = t('core.voice.orari');
  const text = t('demo.market.text');
  return {
    id: MARKET_ID, source: 'demo', tone: 'warning', icon: 'clock', title: label, text,
    meta: `${format.scheduleLabel(MARKET_SCHEDULE)} · ${t('core.alert.sign')}`, distM,
    speakText: `${label} ${text}`, lang: i18n.getLang(),
  };
}

function demoSource() {
  return {
    id: 'demo', watch: [],
    load: async () => targets.map((x) => ({ ...x })),
    card: async (id, ctx) => (id === MARKET_ID ? marketCard(ctx.distM) : null),
    onFired: async () => {},
    onMuted: async () => {},
  };
}

function unlock() {
  // Inside the tap: sound and speech need the user activation.
  cues.unlockAudio();
  speech.unlock();
}

/** "Parti". Call directly in the click handler. Refused with AppError 'demo-shift' during a real shift. */
export async function startDemo() {
  unlock();
  provider = geo.createSimProvider(demoTrack(), { acc: GPS_ACC_M });
  await sandbox.enter({ seed: {}, clockStart: demoClockStart(clock.now()), provider });
  // These writes go to the demo database only. The script is timed for the holder mode and 80 m.
  await settings.set('shift.mode', 'holder');
  await settings.set('alert.radiusM', RADIUS_M);
  presenter.configure({ autoCloseMs: 7000 });
  targets = [marketTarget()];
  if (registered) await proximity.reload();
  else {
    registered = true;
    proximity.registerSource(demoSource());
  }
  await session.startShift({ location: true });
}

/** "Rivedi": a new shift on the same sandbox, the van back at the start of its track. */
export async function replayDemo() {
  unlock();
  if (session.active()) await session.endShift();
  provider?.restart();
  targets = [marketTarget()];
  await proximity.reload();
  await session.startShift({ location: true });
}

/** The `cane` note of beat 1. @returns {Promise<boolean>} false when it was already saved */
export async function saveDog() {
  if (targets.some((x) => x.id === DOG_ID)) return false;
  targets = [...targets, dogTarget(t('core.voice.cane'))];
  await proximity.reload();
  cues.playCue('saved');
  cues.haptic('saved');
  return true;
}

/** Reloads the page: boot deletes the demo database, no sandbox state survives. */
export function exitDemo() {
  sandbox.exit();
}

export function demoActive() {
  return sandbox.active();
}
