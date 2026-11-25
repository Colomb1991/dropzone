// @ts-check
// Decode → scale → (stamp) → JPEG. Re-encoding removes EXIF, including the camera's GPS tags.
import { AppError } from '../errors.js';

export const PHOTO_NOTE = { maxEdge: 1280, quality: 0.75, maxBytes: 614400 };
export const PHOTO_VAN = { maxEdge: 1600, quality: 0.72, maxBytes: 1048576 };

function encode(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

function draw(img, maxEdge, stamp) {
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  const k = Math.min(1, maxEdge / long);
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, w, h);
  if (stamp) {
    const strip = Math.max(28, Math.round(h * 0.04));
    g.fillStyle = '#000';
    g.fillRect(0, h - strip, w, strip);
    g.fillStyle = '#fff';
    g.font = `${Math.round(strip * 0.6)}px monospace`;
    g.textBaseline = 'middle';
    g.fillText(stamp, Math.round(strip * 0.3), h - strip / 2, w - Math.round(strip * 0.6));
  }
  return canvas;
}

/**
 * @param {Blob} file
 * @param {{maxEdge:number, quality:number, maxBytes:number, stamp?:string}} opts
 * @returns {Promise<{mime:'image/jpeg', bytes:ArrayBuffer, w:number, h:number}>}
 */
export async function processPhoto(file, opts) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  let canvas = null;
  try {
    img.src = url;
    await img.decode();
    // Over the limit: lower quality once, then a smaller edge once.
    const tries = [[opts.maxEdge, opts.quality], [opts.maxEdge, opts.quality - 0.15],
      [Math.round(opts.maxEdge * 0.75), opts.quality - 0.15]];
    let blob = null;
    for (const [edge, quality] of tries) {
      if (canvas) canvas.width = canvas.height = 0;
      canvas = draw(img, edge, opts.stamp);
      blob = await encode(canvas, quality);
      if (blob && blob.size <= opts.maxBytes) break;
    }
    if (!blob || !canvas) throw new Error('encode');
    return { mime: 'image/jpeg', bytes: await blob.arrayBuffer(), w: canvas.width, h: canvas.height };
  } catch (err) {
    throw new AppError('photo-decode', 'core.err.photo', { cause: err });
  } finally {
    URL.revokeObjectURL(url);
    if (canvas) canvas.width = canvas.height = 0;
  }
}
