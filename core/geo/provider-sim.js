// @ts-check
// Simulated GPS for the demo: one fix per second, interpolated along a track.
import { now } from '../clock.js';
import { onTick } from '../tick.js';
import { distM } from '../pure/geo-math.js';

/** Position and speed at `ms` along the track. Pure. */
export function trackAt(track, ms) {
  if (track.length === 0) return null;
  if (ms <= track[0].t) return { lat: track[0].lat, lon: track[0].lon, speed: 0 };
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1];
    const b = track[i];
    if (ms > b.t) continue;
    const k = (ms - a.t) / Math.max(1, b.t - a.t);
    const speed = distM(a.lat, a.lon, b.lat, b.lon) / Math.max(0.001, (b.t - a.t) / 1000);
    return { lat: a.lat + (b.lat - a.lat) * k, lon: a.lon + (b.lon - a.lon) * k, speed };
  }
  const last = track[track.length - 1];
  return { lat: last.lat, lon: last.lon, speed: 0 };
}

/**
 * @param {{t:number, lat:number, lon:number}[]} track t = ms from the start
 * @param {{acc?:number, loop?:boolean}} [opts]
 * @returns {import('../types.js').GeoProvider & {pause():void, resume():void, restart():void}}
 */
export function createSimProvider(track, opts = {}) {
  const acc = opts.acc ?? 8;
  const total = track.length ? track[track.length - 1].t : 0;
  let elapsed = 0;
  let paused = false;
  const sample = () => {
    const ms = opts.loop && total > 0 ? elapsed % total : elapsed;
    const p = trackAt(track, ms) ?? { lat: 0, lon: 0, speed: 0 };
    return { lat: p.lat, lon: p.lon, acc, speed: p.speed, heading: null, ts: now(), sim: true };
  };
  return {
    id: 'sim',
    watch(onRaw) {
      onRaw(sample());
      return onTick(() => {
        if (paused) return;
        elapsed += 1000;
        onRaw(sample());
      }, 1000);
    },
    getOnce() {
      return Promise.resolve(sample());
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    restart() {
      elapsed = 0;
    },
  };
}
