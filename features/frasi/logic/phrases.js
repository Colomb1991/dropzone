// @ts-check
// Frasi pronte (SPEC 11): twelve doorstep and intercom phrases. The words live in the dictionaries
// (`frasi.it.<n>` is what the phone says, `frasi.en.<n>` what it means); this is their order. Pure.

/** @typedef {{id:number, group:'intercom'|'door'}} Phrase */

/** @type {Phrase[]} */
export const PHRASES = [
  { id: 1, group: 'intercom' }, { id: 2, group: 'intercom' }, { id: 3, group: 'intercom' },
  { id: 4, group: 'intercom' }, { id: 5, group: 'intercom' }, { id: 6, group: 'intercom' },
  { id: 7, group: 'door' }, { id: 8, group: 'door' }, { id: 9, group: 'door' },
  { id: 10, group: 'door' }, { id: 11, group: 'door' }, { id: 12, group: 'door' },
];

export const GROUPS = /** @type {const} */ (['intercom', 'door']);

/** Always Italian, whatever the language of the app. */
export const SPEAK_LANG = 'it-IT';
/** "Lento". */
export const SLOW_RATE = 0.7;

/** @param {'intercom'|'door'} group @returns {Phrase[]} */
export function phrasesOf(group) {
  return PHRASES.filter((p) => p.group === group);
}

/**
 * Options for the speech wrapper: slow is a fixed rate, otherwise the courier's own voice speed.
 * @param {boolean} slow @returns {{lang:'it-IT', rate?:number}}
 */
export function speakOptions(slow) {
  return slow ? { lang: SPEAK_LANG, rate: SLOW_RATE } : { lang: SPEAK_LANG };
}

/**
 * Why a phrase cannot be heard, or null.
 * @param {{voiceOn:boolean, hasVoice:boolean}} s @returns {null|'off'|'none'}
 */
export function speechProblem(s) {
  if (!s.voiceOn) return 'off';
  return s.hasVoice ? null : 'none';
}
