// @ts-check
// What the shift screens must remember between routes: the shift that just ended (end card), the
// shift whose briefing is due, and three one-time flags kept in the `kv` store.
import { t, events, db, log, format } from '../../core/api.js';
import { toast } from '../../ui/kit/index.js';

const KV_AUTOLOCK = 'turno.autolock';
const KV_CONTRACT = 'turno.contractAsked';

/** @type {import('../../core/types.js').Shift|null} */
let ended = null;
/** @type {string|null} */
let briefingFor = null;
/** @type {string|null} */
let recoveryDismissedFor = null;
/** @type {Set<() => void>} */
const subs = new Set();
const notify = () => subs.forEach((fn) => fn());

/** Feature start(): listens for the whole life of the app. @returns {() => void} */
export function start() {
  const offs = [
    events.on('shift:started', (e) => {
      ended = null;
      briefingFor = e.shift.id;
      notify();
    }),
    events.on('shift:ended', (e) => {
      ended = e.shift;
      briefingFor = null;
      notify();
    }),
    events.on('break:ended', (e) => {
      // Closed by the app at its planned end (SPEC 4.2): say so, the hours can be corrected in Ore.
      if (e.auto) toast(t('turno.break.closed', { time: format.time(e.at) }), { icon: 'coffee', ms: 8000 });
    }),
    events.on('data:wiped', () => {
      ended = null;
      notify();
    }),
  ];
  return () => offs.forEach((off) => off());
}

/** @param {() => void} cb @returns {() => void} */
export function onChange(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function endedShift() {
  return ended;
}

export function clearEnded() {
  ended = null;
  notify();
}

/** True once, right after "Inizia turno" (never after a reload). */
export function takeBriefing(shiftId) {
  if (briefingFor !== shiftId) return false;
  briefingFor = null;
  return true;
}

export function recoveryDismissed(shiftId) {
  return recoveryDismissedFor === shiftId;
}

export function dismissRecovery(shiftId) {
  recoveryDismissedFor = shiftId;
}

const read = (key) => db.get('kv', key).catch((err) => {
  log.error('turno', err);
  return undefined;
});
const write = (rec) => db.put('kv', rec).catch((err) => log.error('turno', err));

/** Id of the shift that showed the Auto-Lock sheet, or null. */
export async function autoLockShiftId() {
  return (await read(KV_AUTOLOCK))?.shiftId ?? null;
}

export function markAutoLock(shiftId) {
  return write({ key: KV_AUTOLOCK, shiftId });
}

export async function contractAsked() {
  return (await read(KV_CONTRACT))?.value === true;
}

export function markContractAsked() {
  return write({ key: KV_CONTRACT, value: true });
}
