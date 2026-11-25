// @ts-check
// Demo: the real pipeline on a separate database, a shifted clock and a simulated GPS.
// The gateway and share check store.sandbox. Exit = reload.
import * as db from './db/db.js';
import * as store from './store.js';
import * as settings from './settings.js';
import * as clock from './clock.js';
import * as geo from './geo/geo.js';
import * as env from './env.js';
import * as engine from './alerts/proximity-engine.js';
import { AppError } from './errors.js';

let on = false;

/**
 * @param {{seed?: Record<string, object[]>, clockStart?: number,
 *   provider: import('./types.js').GeoProvider}} opts
 * @returns {Promise<void>} refused (AppError 'demo-shift') while a real shift is open
 */
export async function enter(opts) {
  if (on) return;
  if (store.getState().shift) throw new AppError('demo-shift', 'core.err.demoShift');
  const mine = await db.getAll('settings');
  await db.deleteDemoDatabase();
  db.useDatabase(db.demoName());
  await db.openDb();
  on = true;
  store.setState({ sandbox: true });
  // The user's settings are copied in, so the demo looks and sounds like their app.
  await db.putMany('settings', mine);
  for (const name of Object.keys(opts.seed ?? {})) await db.putMany(name, /** @type {any} */ (opts.seed)[name]);
  await settings.loadSettings();
  if (typeof opts.clockStart === 'number') clock.setOffset(opts.clockStart - clock.now());
  geo.setProvider(opts.provider);
  // Targets loaded from the real database must not show up in the demo.
  await engine.reload();
}

/** Reload: no sandbox state survives. Boot deletes the demo database. */
export function exit() {
  env.reloadApp();
}

export function active() {
  return on;
}
