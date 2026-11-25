// @ts-check
// Meteo del turno (SPEC 11): one line in the shift briefing, from Open-Meteo. Off until the courier
// turns on "Meteo online" in Settings (svc.weather); never in the demo. The gateway rounds the
// position to 1 decimal (about 10 km); the answer is kept 60 minutes and never enters a backup.
import { events } from '../../core/api.js';
import { validateWeather } from './logic/forecast.js';

const data = () => import('./logic/data.js');

export default {
  id: 'meteo',
  i18n: { it: () => import('./i18n/it.js'), en: () => import('./i18n/en.js') },
  stores: [{ name: 'weather', keyPath: 'id', since: 1, backup: 'never', validate: validateWeather }],
  slots: [
    { slot: 'briefing', order: 30, provide: async (ctx) => (await data()).briefing(ctx) },
    // The same line on the shift home, when nothing more useful is there. Never a new request.
    { slot: 'shift.context', order: 30, watch: ['weather'], provide: async (ctx) => (await data()).contextRows(ctx) },
  ],
  // The one request of the shift starts with the shift, so the briefing finds it already running.
  start: () => events.on('shift:started', (e) => {
    data().then((m) => m.warm(e?.shift?.id ?? ''));
  }),
};
