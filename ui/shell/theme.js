// @ts-check
// Runtime side of theme-boot.js: re-applies the theme when the setting changes and mirrors the
// resolved theme into the store (the map and the alert card read it).
import * as store from '../../core/store.js';
import * as settings from '../../core/settings.js';
import * as events from '../../core/events.js';

const resolved = () => {
  const v = document.documentElement.dataset.theme;
  return v === 'light' || v === 'hc' ? v : 'dark';
};
const reapply = () => document.dispatchEvent(new Event('dz:theme'));

let started = false;

/** Boot calls this once, after the settings are loaded. */
export function startTheme() {
  if (started || typeof document === 'undefined') return;
  started = true;
  const sync = () => store.setState({ theme: resolved() });
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  settings.onChange('theme', reapply);
  events.on('data:wiped', reapply);
  // The "sun" override lasts for one shift.
  events.on('shift:ended', () => setShiftContrast(false));
  reapply();
  sync();
}

/** "Sun" button: high contrast until the shift ends, without touching the saved setting. */
export function setShiftContrast(on) {
  const root = document.documentElement;
  if (on) root.dataset.themeLock = 'hc';
  else delete root.dataset.themeLock;
  reapply();
}

export function shiftContrast() {
  return document.documentElement.dataset.themeLock === 'hc';
}
