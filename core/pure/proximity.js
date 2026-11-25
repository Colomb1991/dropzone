// @ts-check
// SPEC 6.1 and ARCHITECTURE 0.0 row 2.8 (Release 1 rules).
import { distM, M_PER_DEG_LAT } from './geo-math.js';
import { isScheduleActive } from './schedule.js';

const GRACE_MS = 10000;
const HITS = 2;
const OUTS = 3;
const DAY_MS = 86400000;

/** @typedef {import('../types.js').ProxTarget} ProxTarget */
/** @typedef {import('../types.js').Fix} Fix */
/** @typedef {{phase:'idle'|'inside', hits:number, outs:number, reAtFire:number, firedAt:number|null,
 *   seenAt:number}} TargetState */
/** @typedef {{byId:Record<string,TargetState>, firstFixAt:number|null, prunedAt:number}} ProxState */
/** @typedef {{radiusM:number, shiftStartAt:number}} ProxSettings */

/** @returns {ProxState} */
export function initialProxState() {
  return { byId: {}, firstFixAt: null, prunedAt: 0 };
}

/** Call at shift start and on every resume: the next 10 s arm targets without firing. */
export function resetGrace(state) {
  return { ...state, firstFixAt: null };
}

/** Re = fixed radius, or min(400, max(R, speed × 12 s)). */
export function effectiveRadius(target, speed, radiusM) {
  if (typeof target.fixedRadiusM === 'number') return target.fixedRadiusM;
  return Math.min(400, Math.max(radiusM, (speed ?? 0) * 12));
}

function coolingDown(target, st, now, shiftStartAt) {
  const a = st.firedAt;
  const b = target.lastFiredAt ?? null;
  const last = a === null ? b : (b === null ? a : Math.max(a, b));
  if (last === null) return false;
  const mode = target.cooldown ?? 'shift';
  if (mode === 'once') return true;
  if (mode === 'shift') return last >= shiftStartAt;
  return now - last < mode * 60000;
}

/**
 * Approach-class targets only. Returns the ids to fire now.
 * @param {ProxState} state
 * @param {Fix} fix
 * @param {ProxTarget[]} targets
 * @param {number} now
 * @param {ProxSettings} settings
 * @returns {{state: ProxState, fire: string[], dist: Record<string, number>}}
 */
export function proximityStep(state, fix, targets, now, settings) {
  if (!fix.usable) return { state, fire: [], dist: {} };
  const firstFixAt = state.firstFixAt ?? fix.ts;
  const grace = fix.ts < firstFixAt + GRACE_MS;
  const byId = { ...state.byId };
  /** @type {string[]} */
  const fire = [];
  /** @type {Record<string, number>} */
  const dist = {};
  let date = null;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if ((t.cls ?? 'approach') !== 'approach') continue;
    const prev = byId[t.id];
    const re = effectiveRadius(t, fix.speed, settings.radiusM);
    // Cheap latitude pre-check instead of a spatial index (linear pass, ≤ 3,000 notes).
    if (!prev && Math.abs(t.lat - fix.lat) * M_PER_DEG_LAT > re) continue;
    if (fix.acc > Math.max(25, 0.6 * re)) continue;
    const d = distM(fix.lat, fix.lon, t.lat, t.lon);
    const st = prev
      ? { ...prev, seenAt: now }
      : { phase: /** @type {'idle'} */ ('idle'), hits: 0, outs: 0, reAtFire: 0, firedAt: null, seenAt: now };
    if (st.phase === 'inside') {
      dist[t.id] = d;
      st.outs = d > 1.5 * st.reAtFire + 30 ? st.outs + 1 : 0;
      if (st.outs >= OUTS) {
        st.phase = 'idle';
        st.hits = 0;
        st.outs = 0;
      }
      byId[t.id] = st;
      continue;
    }
    if (d > re) {
      if (st.firedAt === null) delete byId[t.id];
      else byId[t.id] = { ...st, hits: 0 };
      continue;
    }
    dist[t.id] = d;
    date = date ?? new Date(now);
    const eligible = t.output !== 'silent' && (t.mutedUntil ?? 0) <= now && isScheduleActive(t.schedule, date);
    if (!eligible) {
      if (st.firedAt === null) delete byId[t.id];
      else byId[t.id] = { ...st, hits: 0 };
      continue;
    }
    st.hits += 1;
    if (st.hits >= HITS) {
      st.phase = 'inside';
      st.reAtFire = re;
      st.outs = 0;
      // Grace: inside without firedAt, so it can fire after an exit.
      if (!grace && !coolingDown(t, st, now, settings.shiftStartAt)) {
        st.firedAt = now;
        fire.push(t.id);
      }
    }
    byId[t.id] = st;
  }
  let prunedAt = state.prunedAt;
  if (now - prunedAt > 3600000) {
    prunedAt = now;
    for (const id of Object.keys(byId)) {
      if (now - byId[id].seenAt > DAY_MS) delete byId[id];
    }
  }
  return { state: { byId, firstFixAt, prunedAt }, fire, dist };
}

/**
 * Stop trigger: stop-class targets within `radiusM`, schedule active, not muted, not yet announced.
 * @param {Fix} fix
 * @param {ProxTarget[]} targets
 * @param {Set<string>} announced
 * @param {number} now
 * @param {number} [radiusM]
 * @returns {string[]} nearest first
 */
export function stopCandidates(fix, targets, announced, now, radiusM = 60) {
  if (!fix || !fix.usable) return [];
  const date = new Date(now);
  const found = [];
  for (const t of targets) {
    if (t.cls !== 'stop' || announced.has(t.id)) continue;
    if (Math.abs(t.lat - fix.lat) * M_PER_DEG_LAT > radiusM) continue;
    if ((t.mutedUntil ?? 0) > now || !isScheduleActive(t.schedule, date)) continue;
    const d = distM(fix.lat, fix.lon, t.lat, t.lon);
    if (d <= radiusM) found.push({ id: t.id, d });
  }
  return found.sort((a, b) => a.d - b.d).map((x) => x.id);
}

/**
 * "Cosa so di qui": any class, any schedule state.
 * @param {{lat:number, lon:number}} fix
 * @param {ProxTarget[]} targets
 * @param {number} radiusM
 * @returns {{id:string, distM:number}[]} nearest first
 */
export function nearby(fix, targets, radiusM) {
  const out = [];
  for (const t of targets) {
    if (Math.abs(t.lat - fix.lat) * M_PER_DEG_LAT > radiusM) continue;
    const d = distM(fix.lat, fix.lon, t.lat, t.lon);
    if (d <= radiusM) out.push({ id: t.id, distM: d });
  }
  return out.sort((a, b) => a.distM - b.distM);
}
