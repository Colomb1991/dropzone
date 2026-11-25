// @ts-check
// QR code encoder for the invite screen (SPEC 11): byte mode, error correction M, versions 1 to 10
// (213 bytes at most, far more than the app address needs). Pure: no DOM, no dependency.
// Model 2 symbols as in ISO/IEC 18004; rows and columns count from the top-left corner.

/** Level M, per version (index 0 unused): error-correction codewords per block, then the groups of
 *  [number of blocks, data codewords per block]. */
const BLOCKS = [
  { ec: 0, groups: [] },
  { ec: 10, groups: [[1, 16]] },
  { ec: 16, groups: [[1, 28]] },
  { ec: 26, groups: [[1, 44]] },
  { ec: 18, groups: [[2, 32]] },
  { ec: 24, groups: [[2, 43]] },
  { ec: 16, groups: [[4, 27]] },
  { ec: 18, groups: [[4, 31]] },
  { ec: 22, groups: [[2, 38], [2, 39]] },
  { ec: 22, groups: [[3, 36], [2, 37]] },
  { ec: 26, groups: [[4, 43], [1, 44]] },
];
/** Centres of the alignment patterns, per version. */
const ALIGN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46],
  [6, 28, 50]];

export const MAX_VERSION = 10;
/** Light modules around the symbol; the standard asks for four. */
export const QUIET = 4;

// ---- Reed-Solomon over GF(256), polynomial x^8 + x^4 + x^3 + x^2 + 1 ----

const EXP = new Uint8Array(510);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  EXP[i + 255] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Generator polynomial of degree `n`, highest power first (the leading 1 included). */
function generator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}

/**
 * Error-correction codewords of one block: the remainder of the division by the generator.
 * @param {ArrayLike<number>} data @param {number} ecLen @returns {number[]}
 */
export function rsRemainder(data, ecLen) {
  const g = generator(ecLen);
  const rem = new Array(ecLen).fill(0);
  for (let k = 0; k < data.length; k++) {
    const factor = data[k] ^ rem[0];
    rem.shift();
    rem.push(0);
    for (let i = 0; i < ecLen; i++) rem[i] ^= mul(g[i + 1], factor);
  }
  return rem;
}

// ---- data codewords ----

const dataCodewords = (v) => BLOCKS[v].groups.reduce((n, [count, len]) => n + count * len, 0);
/** Bits of the character count in byte mode. */
const countBits = (v) => (v < 10 ? 8 : 16);

/** Bytes a version holds at level M in byte mode. @param {number} version 1 to 10 */
export function capacity(version) {
  return Math.floor((dataCodewords(version) * 8 - 4 - countBits(version)) / 8);
}

/** The smallest version that holds `length` bytes. Throws RangeError('qr-too-long') past version 10. */
export function versionFor(length) {
  for (let v = 1; v <= MAX_VERSION; v++) if (length <= capacity(v)) return v;
  throw new RangeError('qr-too-long');
}

/** UTF-8 bytes of a text. */
export function utf8(text) {
  return new TextEncoder().encode(String(text));
}

/** Mode, count, data, terminator and pad bytes: exactly the data codewords of the version. */
export function dataBytes(bytes, version) {
  const total = dataCodewords(version);
  /** @type {number[]} */
  const bits = [];
  const put = (value, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, countBits(version));
  for (let i = 0; i < bytes.length; i++) put(bytes[i], 8);
  put(0, Math.min(4, total * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    out.push(byte);
  }
  for (let pad = 0xec; out.length < total; pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

/** Data and error-correction codewords in the order they are drawn (blocks interleaved). */
export function codewords(bytes, version) {
  const { ec, groups } = BLOCKS[version];
  const data = dataBytes(bytes, version);
  const blocks = [];
  let at = 0;
  for (const [count, len] of groups) {
    for (let i = 0; i < count; i++) {
      const d = data.slice(at, at + len);
      at += len;
      blocks.push({ d, e: rsRemainder(d, ec) });
    }
  }
  const out = [];
  const longest = Math.max(...blocks.map((b) => b.d.length));
  for (let i = 0; i < longest; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ec; i++) for (const b of blocks) out.push(b.e[i]);
  return out;
}

// ---- format and version information ----

/** The 15 format bits for level M and a mask (BCH 15,5 and the fixed XOR). */
export function formatBits(mask) {
  // Level M is 00, so the five data bits are the mask alone.
  const data = mask & 7;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

/** The 18 version bits (BCH 18,6); drawn from version 7. */
export function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

// ---- the symbol ----

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r * c) % 3) + ((r + c) % 2)) % 2 === 0,
];

/** Finder, timing and alignment patterns, the dark module, and the reserved information areas. */
function functionPatterns(version) {
  const size = version * 4 + 17;
  const modules = new Uint8Array(size * size);
  const reserved = new Uint8Array(size * size);
  const set = (r, c, dark) => {
    modules[r * size + c] = dark ? 1 : 0;
    reserved[r * size + c] = 1;
  };
  const finder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const ring = (dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) || (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6));
        set(r, c, ring || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const centres = ALIGN[version];
  for (const r of centres) {
    for (const c of centres) {
      // Not where a finder pattern already is.
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
      }
    }
  }
  // Format information: reserved now, written once the mask is known.
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      set(8, i, false);
      set(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) set(8, size - 1 - i, false);
  for (let i = 0; i < 7; i++) set(size - 1 - i, 8, false);
  set(size - 8, 8, true);
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }
  return { size, modules, reserved };
}

function drawFormat(modules, size, mask) {
  const bits = formatBits(mask);
  const bit = (i) => (bits >>> i) & 1;
  for (let i = 0; i <= 5; i++) modules[i * size + 8] = bit(i);
  modules[7 * size + 8] = bit(6);
  modules[8 * size + 8] = bit(7);
  modules[8 * size + 7] = bit(8);
  for (let i = 9; i < 15; i++) modules[8 * size + (14 - i)] = bit(i);
  for (let i = 0; i < 8; i++) modules[8 * size + (size - 1 - i)] = bit(i);
  for (let i = 8; i < 15; i++) modules[(size - 15 + i) * size + 8] = bit(i);
}

/** Codewords in the zigzag from the bottom-right corner, masked; leftover modules stay light before the mask. */
function drawData(base, words, mask) {
  const { size, reserved } = base;
  const modules = base.modules.slice();
  const masked = MASKS[mask];
  const total = words.length * 8;
  let n = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    // The vertical timing pattern takes a whole column.
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (reserved[r * size + c]) continue;
        const bit = n < total ? (words[n >>> 3] >>> (7 - (n & 7))) & 1 : 0;
        n++;
        modules[r * size + c] = bit ^ (masked(r, c) ? 1 : 0);
      }
    }
  }
  drawFormat(modules, size, mask);
  return modules;
}

const FINDER_LIKE = [[1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]];

/** Penalty of a masked symbol (ISO/IEC 18004, the four rules): the mask with the lowest one is used. */
export function penalty(modules, size) {
  let score = 0;
  let dark = 0;
  const line = new Uint8Array(size);
  const scoreLine = () => {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) score += run - 2;
        run = 1;
      }
    }
    for (let i = 0; i + 11 <= size; i++) {
      for (const pattern of FINDER_LIKE) {
        let same = true;
        for (let j = 0; j < 11 && same; j++) same = line[i + j] === pattern[j];
        if (same) score += 40;
      }
    }
  };
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      line[c] = modules[r * size + c];
      dark += line[c];
    }
    scoreLine();
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r < size; r++) line[r] = modules[r * size + c];
    scoreLine();
  }
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r * size + c];
      if (v === modules[r * size + c + 1] && v === modules[(r + 1) * size + c] && v === modules[(r + 1) * size + c + 1]) {
        score += 3;
      }
    }
  }
  const total = size * size;
  return score + Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
}

/** @typedef {{version:number, size:number, mask:number, modules:Uint8Array}} Qr  `modules`: row by row, 1 = dark */

/**
 * @param {string|Uint8Array} data text (sent as UTF-8) or bytes
 * @param {{mask?:number}} [opts] `mask` 0 to 7 forces a mask (tests); otherwise the best one is chosen
 * @returns {Qr} throws RangeError('qr-too-long') over 213 bytes
 */
export function encodeQr(data, opts = {}) {
  const bytes = typeof data === 'string' ? utf8(data) : data;
  const version = versionFor(bytes.length);
  const base = functionPatterns(version);
  const words = codewords(bytes, version);
  if (Number.isInteger(opts.mask) && /** @type {number} */ (opts.mask) >= 0 && /** @type {number} */ (opts.mask) <= 7) {
    const mask = /** @type {number} */ (opts.mask);
    return { version, size: base.size, mask, modules: drawData(base, words, mask) };
  }
  let best = { mask: 0, modules: drawData(base, words, 0), score: Infinity };
  best.score = penalty(best.modules, base.size);
  for (let mask = 1; mask < 8; mask++) {
    const modules = drawData(base, words, mask);
    const score = penalty(modules, base.size);
    if (score < best.score) best = { mask, modules, score };
  }
  return { version, size: base.size, mask: best.mask, modules: best.modules };
}

/** One string of 0 and 1 per row (tests, debugging). @param {Qr} qr */
export function qrRows(qr) {
  const rows = [];
  for (let r = 0; r < qr.size; r++) rows.push(Array.from(qr.modules.subarray(r * qr.size, (r + 1) * qr.size)).join(''));
  return rows;
}

/**
 * SVG path of the dark modules, one unit per module, inside a quiet zone. The drawing is
 * `size + 2 × quiet` units wide: use that as the viewBox.
 * @param {Qr} qr @param {number} [quiet] @returns {{d:string, box:number}}
 */
export function qrPath(qr, quiet = QUIET) {
  let d = '';
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (!qr.modules[r * qr.size + c]) continue;
      let len = 1;
      while (c + len < qr.size && qr.modules[r * qr.size + c + len]) len++;
      d += `M${c + quiet} ${r + quiet}h${len}v1h-${len}z`;
      c += len;
    }
  }
  return { d, box: qr.size + quiet * 2 };
}
