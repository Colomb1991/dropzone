// @ts-check
// The four legal pages (legal README 1) and the values of their placeholders.

export const DOC_IDS = /** @type {const} */ (['privacy', 'termini', 'avvertenze', 'servizi']);

const FILES = { privacy: 'privacy', termini: 'terms' };
export const CONTENT_DIR = 'features/legale/content/';

/** @param {string} id @returns {'privacy'|'termini'|'avvertenze'|'servizi'} unknown ids open the privacy notice */
export function docId(id) {
  return /** @type {any} */ (DOC_IDS).includes(id) ? /** @type {any} */ (id) : 'privacy';
}

/**
 * File of a page inside content/, or null for the page built from the dictionaries (avvertenze).
 * @param {string} id @param {'it'|'en'} lang
 */
export function docFile(id, lang) {
  if (id === 'servizi') return 'notices.md';
  if (id === 'privacy' || id === 'termini') return `${FILES[id]}.${lang === 'en' ? 'en' : 'it'}.md`;
  return null;
}

/** '2026-11-25' → local Date at noon (safe on DST days). */
export function parseDocDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : new Date(NaN);
}

/** True while the owner has not filled config/operator.js. */
export function operatorMissing(op) {
  return !op || String(op.name ?? '').trim() === '' || String(op.email ?? '').trim() === '';
}

/**
 * @param {{appName:string, appUrl:string, operator:{name:string, email:string}, dateText:string,
 *   missingText:string}} v
 * @returns {Record<string, string>}
 */
export function legalVars(v) {
  const name = String(v.operator?.name ?? '').trim();
  const email = String(v.operator?.email ?? '').trim();
  return {
    APP_NAME: v.appName, APP_URL: v.appUrl, LAST_UPDATED: v.dateText,
    OPERATOR_NAME: name || v.missingText, CONTACT_EMAIL: email || v.missingText,
  };
}

/** True when the stored terms version is not the one this build ships (legal notice 12). */
export function termsOutdated(onboardedAt, storedVersion, currentVersion) {
  return onboardedAt !== null && onboardedAt !== undefined && storedVersion !== currentVersion;
}
