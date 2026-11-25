// @ts-check
// When a new version of the app is applied, offered or held back, and how often the app looks for
// one (ARCHITECTURE 3, "Update prompt").

/** Shortest time between two checks made on a return to the foreground. */
export const UPDATE_CHECK_MS = 15 * 60000;

/**
 * What to do with a new version that is installed and waiting behind the running one.
 * - `apply`: switch to it and reload now, without asking (boot, before the first render);
 * - `offer`: banner "Nuova versione pronta." and row "Aggiorna l'app", both with a tap to apply;
 * - `hold`: known, not offered here and now (the vehicle is moving, or this is a second window).
 * An open shift is deliberately not an input: the shift is in the database and
 * session.resumeIfOpen() picks it up after the reload, so it no longer delays an update.
 * @param {{waiting:boolean, primary:boolean, moving:boolean, boot?:boolean, justUpdated?:boolean}} s
 *   `moving` is the vehicle (store.moving), passenger or not; `boot`: nothing is on screen yet;
 *   `justUpdated`: this start is itself the reload of an update (never two reloads in a row)
 * @returns {'none'|'apply'|'offer'|'hold'}
 */
export function updateAction(s) {
  if (!s.waiting) return 'none';
  if (!s.primary) return 'hold';
  if (s.boot) return s.justUpdated ? 'hold' : 'apply';
  return s.moving ? 'hold' : 'offer';
}

/** @param {number} now @param {number} lastCheckAt 0 = not yet in this session @returns {boolean} */
export function updateCheckDue(now, lastCheckAt) {
  return now - lastCheckAt >= UPDATE_CHECK_MS;
}
