// @ts-check
// File inputs: the camera and the file picker. Both must be called in a click.

/** @returns {Promise<File|null>} */
function pick(accept, capture) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.hidden = true;
    if (capture) input.setAttribute('capture', capture);
    let settled = false;
    const finish = (file) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

/** Rear camera. Null when cancelled. Save the note before calling this. */
export function takePhoto() {
  return pick('image/*', 'environment');
}

/** "Importa file", "Importa backup". @param {string} [accept] */
export function pickFile(accept = '.txt,text/plain') {
  return pick(accept, null);
}
