// @ts-check
// Section accents (DESIGN 0.1): colour is a code the courier learns once. Every section has one
// accent, the same wherever the section shows up: its tile on the home, its row in "Altro" and in
// "Strumenti", its tab, the icon in the header of its own screen. Chosen here, nowhere else.
// The colours themselves are tokens (css/tokens.css, --accent-*); this file only names them.
import { createContext } from '../html.js';

/** The palette: seven accents and the neutral of the sections about the app itself. */
export const ACCENTS = /** @type {const} */ (['blue', 'cyan', 'mint', 'amber', 'violet', 'coral', 'pink', 'neutral']);

/**
 * Feature id → accent, by family:
 * blue = the shift and what happens in it · violet = what you know and say · cyan = places ·
 * mint = time and numbers · amber = the van · pink = colleagues · coral = emergency ·
 * neutral = the app itself.
 * @type {Record<string, typeof ACCENTS[number]>}
 */
export const SECTION_ACCENT = {
  turno: 'blue',
  giro: 'blue',
  meteo: 'blue',
  note: 'violet',
  frasi: 'violet',
  vicino: 'cyan',
  'furgone-qui': 'cyan',
  ore: 'mint',
  ritmo: 'mint',
  furgone: 'amber',
  segnala: 'pink',
  zona: 'pink',
  invita: 'pink',
  sos: 'coral',
  impostazioni: 'neutral',
  legale: 'neutral',
  demo: 'neutral',
  benvenuto: 'neutral',
};

/** The accent of a section, or null for an id that is not a section. @param {string|null|undefined} id */
export function sectionAccent(id) {
  return (id && SECTION_ACCENT[id]) || null;
}

/**
 * The section of the screen on show: set by the shell around every route, read by Screen for the
 * icon in its header. `root` is true on the first screen of a section (never on the home).
 * Value: {id:string, icon:string|null, root:boolean} or null.
 */
export const SectionContext = createContext(/** @type {any} */ (null));
