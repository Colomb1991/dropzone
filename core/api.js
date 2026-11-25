// @ts-check
// Façade: everything a feature may import from core. Features also import core/pure/* directly.
import * as config from '../config/app.js';
import * as clock from './clock.js';
import * as tick from './tick.js';
import * as env from './env.js';
import * as events from './events.js';
import * as store from './store.js';
import * as settings from './settings.js';
import * as i18nAll from './i18n.js';
import * as format from './format.js';
import * as router from './router.js';
import * as slots from './slots.js';
import * as sandbox from './sandbox.js';
import * as log from './log.js';
import * as errors from './errors.js';
import * as dbAll from './db/db.js';
import * as schema from './db/schema.js';
import * as notes from './model/notes.js';
import * as media from './model/media.js';
import * as shifts from './model/shifts.js';
import * as geoAll from './geo/geo.js';
import { createSimProvider } from './geo/provider-sim.js';
import * as session from './shift/session.js';
import * as proximity from './alerts/proximity-engine.js';
import * as presenter from './alerts/presenter.js';
import * as cues from './platform/cues.js';
import * as speech from './platform/speech.js';
import * as wake from './platform/wake.js';
import * as share from './platform/share.js';
import * as handoff from './platform/handoff.js';
import * as install from './platform/install.js';
import * as camera from './platform/camera.js';
import * as clipboard from './platform/clipboard.js';
import * as instance from './platform/instance.js';
import * as gateway from './net/gateway.js';
import * as photo from './media/photo.js';
import * as backup from './data/backup.js';
import * as swClient from './sw-client.js';

export { OPERATOR } from '../config/operator.js';
export { AppError } from './errors.js';
export { NetError } from './net/gateway.js';
export const { t, tn, tRich } = i18nAll;

const i18n = {
  t: i18nAll.t, tn: i18nAll.tn, tRich: i18nAll.tRich, getLang: i18nAll.getLang,
  setLang: i18nAll.setLang, locale: i18nAll.locale,
};
const geo = { ...geoAll, createSimProvider };
const db = { ...dbAll, DB_VERSION: schema.DB_VERSION };

export {
  config, clock, tick, env, events, store, settings, i18n, format, router, slots, sandbox, log, errors,
  db, notes, media, shifts, geo, session, proximity, presenter, cues, speech, wake, share, handoff,
  install, camera, clipboard, instance, gateway, photo, backup, swClient,
};
