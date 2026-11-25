// @ts-check
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(128).fill(255);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

/** @param {Uint8Array|ArrayBuffer} input @returns {string} standard base64 with padding */
export function bytesToBase64(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  const parts = [];
  let chunk = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    chunk += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63]
      + (i + 1 < b.length ? ALPHABET[(n >> 6) & 63] : '=') + (i + 2 < b.length ? ALPHABET[n & 63] : '=');
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = '';
    }
  }
  parts.push(chunk);
  return parts.join('');
}

/** @param {string} text base64 or base64url, padding optional @returns {Uint8Array} throws on bad input */
export function base64ToBytes(text) {
  const s = String(text).replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (s.length % 4 === 1) throw new Error('base64-length');
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    let n = 0;
    let count = 0;
    for (let j = 0; j < 4; j++) {
      const code = s.charCodeAt(i + j);
      if (Number.isNaN(code)) {
        n <<= 6;
        continue;
      }
      const v = code < 128 ? LOOKUP[code] : 255;
      if (v === 255) throw new Error('base64-char');
      n = (n << 6) | v;
      count++;
    }
    if (count > 1) out[o++] = (n >> 16) & 255;
    if (count > 2) out[o++] = (n >> 8) & 255;
    if (count > 3) out[o++] = n & 255;
  }
  return out;
}

/** base64url without padding. */
export function bytesToBase64Url(input) {
  return bytesToBase64(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function textToBase64Url(text) {
  return bytesToBase64Url(new TextEncoder().encode(text));
}

/** Throws on invalid base64 or invalid UTF-8. */
export function base64UrlToText(b64) {
  return new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(b64));
}
