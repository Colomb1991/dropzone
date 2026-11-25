// @ts-check
// The 45-second demo (SPEC 4.13) as data: timeline, simulated track and the two sample notes.
// Pure. The town is made up; the coordinates are a point in the open sea, so nobody's street is shown.
import { offsetM } from '../../../core/pure/geo-math.js';

/** Seconds from "Parti". */
export const TIMES = {
  autoSave: 10,   // the demo saves the note itself when nobody tapped
  drive: 12,      // beat 2: the van leaves
  arrive: 24,     // back at the same gate
  stopFallback: 30, // "Cosa so di qui" shows by now even if the stop was not detected
  here: 7,        // seconds on "Cosa so di qui" before the end card
  total: 45,
};
export const SPEED_MS = 12.5;
export const RADIUS_M = 80;
export const GPS_ACC_M = 8;
export const GATE = { lat: 43.0, lon: 10.0 };
/** The market street: far enough from the gate to stay silent while parked (over the 80 m radius). */
export const MARKET = offsetM(GATE.lat, GATE.lon, 90, 130);
export const MARKET_ID = 'demo-market';
export const DOG_ID = 'demo-dog';
export const MARKET_SCHEDULE = { days: [2, 5], windows: [{ from: '07:00', to: '14:00' }] };

/**
 * Parked for 12 s, then round the block (45 m east towards the market, 30 m north, back west,
 * back south) and parked again at the same gate.
 * @returns {{t:number, lat:number, lon:number}[]} t = ms from the start
 */
export function demoTrack() {
  const east = offsetM(GATE.lat, GATE.lon, 90, 45);
  const northEast = offsetM(east.lat, east.lon, 0, 30);
  const north = offsetM(GATE.lat, GATE.lon, 0, 30);
  const leg = (m) => (m / SPEED_MS) * 1000;
  const t0 = TIMES.drive * 1000;
  const t1 = t0 + leg(45);
  const t2 = t1 + leg(30);
  const t3 = t2 + leg(45);
  return [
    { t: 0, ...GATE }, { t: t0, ...GATE }, { t: t1, ...east }, { t: t2, ...northEast }, { t: t3, ...north },
    { t: TIMES.arrive * 1000, ...GATE }, { t: 600000, ...GATE },
  ];
}

/** The simulated clock starts on the next Tuesday at 09:40 local, strictly after `now`. */
export function demoClockStart(now) {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 40, 0, 0);
  // JavaScript: Tuesday is 2.
  while (start.getDay() !== 2 || start.getTime() <= now) start.setDate(start.getDate() + 1);
  return start.getTime();
}

const target = (id, at, over) => ({
  id, source: 'demo', lat: at.lat, lon: at.lon, fixedRadiusM: null, schedule: null, cooldown: null,
  lastFiredAt: null, mutedUntil: null, ...over,
});

/** `orari` note "Mercato: strada chiusa", Tuesday and Friday 7–14: approach class, spoken. */
export function marketTarget() {
  return target(MARKET_ID, MARKET, { cls: 'approach', tone: 'warning', output: 'voice', schedule: MARKET_SCHEDULE });
}

/** The `cane` note the viewer saves at the gate: stop class, one spoken word. */
export function dogTarget(stopSay) {
  return target(DOG_ID, GATE, { cls: 'stop', tone: 'danger', output: 'voice', stopSay });
}

/**
 * What the stage shows.
 * @param {{elapsedS:number, stoppedS:number|null}} s stoppedS = second the van stopped after its round
 * @returns {'save'|'drive'|'here'|'end'}
 */
export function phaseAt({ elapsedS, stoppedS }) {
  if (elapsedS < TIMES.drive) return 'save';
  const stop = Math.min(stoppedS ?? TIMES.stopFallback, TIMES.stopFallback);
  if (elapsedS < stop) return 'drive';
  return elapsedS < stop + TIMES.here ? 'here' : 'end';
}

/** Beat 1, 2 or 3 of SPEC 4.13 for a phase. */
export function beatOf(phase) {
  return phase === 'save' ? 1 : phase === 'end' ? 3 : 2;
}
