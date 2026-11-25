// @ts-check
/** @type {any} */
let deferred = null;
let listening = false;

/** Boot calls this early so the browser's install event is not missed. */
export function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
  });
}

export function canPrompt() {
  return deferred !== null;
}

/** Call inside a click. @returns {Promise<'accepted'|'dismissed'|'unavailable'>} */
export async function promptInstall() {
  const e = deferred;
  if (!e) return 'unavailable';
  deferred = null;
  e.prompt();
  const choice = await e.userChoice;
  return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
}
