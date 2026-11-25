// @ts-check
// While the van moves (and nobody declared "Sono passeggero") the route outlet and every nav item
// except SOS are inert. A tap on the locked area pulses the "Sei in movimento" banner.
import { useStore } from '../hooks.js';
import { pulseBanner } from './banner-host.js';

/** @returns {boolean} */
export function useMovingLock() {
  return useStore((s) => s.moving && !s.passenger);
}

/** onClick for the app frame: inert content does not receive the tap, the frame does. */
export function lockTapHandler(locked) {
  return (e) => {
    if (locked && e.target === e.currentTarget) pulseBanner();
  };
}
