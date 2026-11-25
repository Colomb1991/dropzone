// @ts-check
import * as log from './log.js';

export class AppError extends Error {
  /** @param {string} code @param {string} [userKey] i18n key @param {{cause?:unknown, data?:object}} [opts] */
  constructor(code, userKey, opts = {}) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.userKey = userKey ?? null;
    this.data = opts.data ?? null;
    if (opts.cause !== undefined) this.cause = opts.cause;
  }
}

/** @param {unknown} err @returns {string} i18n key for the user message */
export function toUserKey(err) {
  return err instanceof AppError && err.userKey ? err.userKey : 'core.err.generic';
}

let installed = false;

/** window 'error' + 'unhandledrejection' → local log. */
export function installGlobalHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => log.error('global', e.error ?? 'error'));
  window.addEventListener('unhandledrejection', (e) => log.error('promise', e.reason ?? 'rejection'));
}
