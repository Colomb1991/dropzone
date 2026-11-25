// @ts-check
import * as log from '../log.js';

/** @returns {Promise<boolean>} */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    log.warn('clipboard', 'write-refused');
    return false;
  }
}

/** Call in a click. @returns {Promise<string|null>} null when refused */
export async function readText() {
  try {
    return await navigator.clipboard.readText();
  } catch (err) {
    log.warn('clipboard', 'read-refused');
    return null;
  }
}
