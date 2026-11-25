// @ts-check
// Onboarding rules (SPEC 4.1). Pure.

export const STEP_COUNT = 5;

/** Step index kept inside 0–4. */
export function clampStep(n) {
  return Math.min(STEP_COUNT - 1, Math.max(0, Number.isFinite(n) ? Math.trunc(n) : 0));
}

/** Install gate: iOS in a browser tab, until the user chose "Usa comunque nel browser". */
export function needsGate({ iosTab, browserUseAccepted }) {
  return iosTab === true && browserUseAccepted !== true;
}

/**
 * i18n keys of the iOS install steps. The share button moved in iOS 26 (labels UNVERIFIED,
 * the owner confirms them on a real iPhone).
 * @param {[number, number]|null} iosVersion
 * @returns {string[]}
 */
export function iosStepKeys(iosVersion) {
  const major = Array.isArray(iosVersion) ? iosVersion[0] : null;
  return typeof major === 'number' && major >= 26
    ? [1, 2, 3, 4].map((n) => `benvenuto.gate.ios26.${n}`)
    : [1, 2, 3].map((n) => `benvenuto.gate.ios.${n}`);
}

/**
 * Which install advice the last step shows.
 * @param {{os:'ios'|'android'|'other', standalone:boolean}} p
 * @returns {'none'|'ios'|'android'}
 */
export function installAdvice({ os, standalone }) {
  if (standalone) return 'none';
  return os === 'ios' ? 'ios' : 'android';
}

/**
 * Settings written by "Inizia", in order: the gate key `onboardedAt` comes last, so a failed
 * write never leaves the user past the gate without the acceptance stored.
 * @param {number} now @param {string} termsVersion
 * @returns {[string, any][]}
 */
export function acceptance(now, termsVersion) {
  return [['termsAcceptedAt', now], ['termsVersion', termsVersion], ['onboardedAt', now]];
}
