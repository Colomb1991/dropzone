// @ts-check
// Prepare, then tap: build the File[] first; call these as the first statement of the click handler.
import * as store from '../store.js';
import * as log from '../log.js';

/** @typedef {'shared'|'cancelled'|'unsupported'|'sandbox'} ShareResult */

function run(data) {
  // No await before navigator.share: it needs the user activation of the click.
  return navigator.share(data).then(() => /** @type {ShareResult} */ ('shared'), (err) => {
    if (err?.name === 'AbortError') return /** @type {ShareResult} */ ('cancelled');
    log.warn('share', 'failed', { name: String(err?.name ?? '') });
    return /** @type {ShareResult} */ ('unsupported');
  });
}

/** @param {{text:string, url?:string}} data @returns {Promise<ShareResult>} */
export function shareText(data) {
  if (store.getState().sandbox) return Promise.resolve('sandbox');
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return Promise.resolve('unsupported');
  return run(data.url ? { text: data.text, url: data.url } : { text: data.text });
}

export function canShareFiles(files) {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function' && navigator.canShare({ files });
}

/** @param {File[]} files @param {string} [text] @returns {Promise<ShareResult>} */
export function shareFiles(files, text) {
  if (store.getState().sandbox) return Promise.resolve('sandbox');
  if (!canShareFiles(files)) return Promise.resolve('unsupported');
  return run(text ? { files, text } : { files });
}

/** <a download> with a blob: URL. */
export function downloadFile(file) {
  if (store.getState().sandbox) return;
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.hidden = true;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** @param {string} name @param {'text/plain'|'text/csv'|'image/jpeg'} mime @param {BlobPart[]} parts */
export function makeFile(name, mime, parts) {
  return new File(parts, name, { type: mime });
}
