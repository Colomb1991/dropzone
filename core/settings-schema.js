// @ts-check
// Release 1 setting keys (ARCHITECTURE 0.0 row 2.4; defaults SPEC 4.12).
import { oneOf, isBool, numOrNull, strOrNull } from './pure/settings-core.js';
import { validateContact } from './pure/validators.js';

const hours = (v) => v === null || (typeof v === 'number' && v >= 20 && v <= 48 && (v * 2) % 1 === 0);

/** @type {Record<string, import('./pure/settings-core.js').SettingDef>} */
export const CORE_SETTINGS = {
  lang: { default: 'it', validate: oneOf('it', 'en'), mirror: true },
  theme: { default: 'auto', validate: oneOf('auto', 'light', 'dark', 'hc'), mirror: true },
  'alert.radiusM': { default: 80, validate: oneOf(40, 80, 150, 250) },
  'voice.on': { default: true, validate: isBool },
  'voice.rate': { default: 1, validate: oneOf(0.85, 1, 1.2) },
  'sound.level': { default: 'normal', validate: oneOf('off', 'normal', 'loud') },
  'contract.weeklyHours': { default: null, validate: hours },
  'contract.daysPerWeek': { default: null, validate: oneOf(5, 6, null) },
  'contract.breakPaid': { default: false, validate: isBool },
  'shift.breakMin': { default: 30, validate: oneOf(15, 30, 45, 60) },
  'shift.mode': { default: null, validate: oneOf('holder', 'pocket', null) },
  'nav.app': { default: 'ask', validate: oneOf('ask', 'google', 'waze', 'apple') },
  'svc.tiles': { default: true, validate: isBool },
  'svc.overpass': { default: true, validate: isBool },
  // Giro address search (Photon): off until the courier turns it on from the one-time sheet.
  'svc.photon': { default: false, validate: isBool },
  // Meteo del turno (Open-Meteo): off until the courier turns it on in Settings.
  'svc.weather': { default: false, validate: isBool },
  'sos.contact': { default: null, validate: validateContact },
  onboardedAt: { default: null, validate: numOrNull },
  termsAcceptedAt: { default: null, validate: numOrNull },
  termsVersion: { default: null, validate: strOrNull },
  lastBackupAt: { default: null, validate: numOrNull },
  lastChangeAt: { default: null, validate: numOrNull },
  firstNoteWarned: { default: false, validate: isBool },
  firstPhotoWarned: { default: false, validate: isBool },
  firstVanWarned: { default: false, validate: isBool },
  locationExplained: { default: false, validate: isBool },
  browserUseAccepted: { default: false, validate: isBool },
  'vicino.lastChip': { default: null, validate: strOrNull },
};
