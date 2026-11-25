// @ts-check
function safeDecode(s) {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch (err) {
    return s;
  }
}

/**
 * @param {string} hash with or without the leading '#'
 * @returns {{kind:'route', path:string, query:Record<string,string>} | {kind:'alert', fragment:string}}
 */
export function parseHash(hash) {
  const h = String(hash ?? '').replace(/^#/, '');
  if (/^a=\d/.test(h)) return { kind: 'alert', fragment: h };
  if (!h.startsWith('/')) return { kind: 'route', path: '/', query: {} };
  const q = h.indexOf('?');
  let path = q < 0 ? h : h.slice(0, q);
  if (path.length > 1) path = path.replace(/\/+$/, '');
  /** @type {Record<string,string>} */
  const query = {};
  if (q >= 0) {
    for (const pair of h.slice(q + 1).split('&')) {
      if (pair === '') continue;
      const eq = pair.indexOf('=');
      query[safeDecode(eq < 0 ? pair : pair.slice(0, eq))] = eq < 0 ? '' : safeDecode(pair.slice(eq + 1));
    }
  }
  return { kind: 'route', path: path || '/', query };
}

/**
 * @param {string} path e.g. '/note/abc/modifica'
 * @param {string[]} patterns e.g. ['/note/:id/modifica']; a literal segment beats a parameter
 * @returns {{pattern:string, params:Record<string,string>}|null}
 */
export function matchRoute(path, patterns) {
  const segs = path.split('/').filter(Boolean);
  let best = null;
  let bestScore = -1;
  for (const pattern of patterns) {
    if (!pattern.startsWith('/')) continue;
    const ps = pattern.split('/').filter(Boolean);
    if (ps.length !== segs.length) continue;
    /** @type {Record<string,string>} */
    const params = {};
    let score = 0;
    let ok = true;
    for (let i = 0; i < ps.length && ok; i++) {
      if (ps[i].startsWith(':')) params[ps[i].slice(1)] = safeDecode(segs[i]);
      else if (ps[i] === segs[i]) score++;
      else ok = false;
    }
    if (ok && score > bestScore) {
      best = { pattern, params };
      bestScore = score;
    }
  }
  return best;
}

/**
 * How deep in the app's own history the entry now shown is. The router numbers every entry it sees
 * (`history.state.dz`): an entry that already carries a number keeps it (the user went back or
 * forward with the system buttons), a new one is one deeper than the last.
 * @param {number} prevDepth depth of the entry shown before; -1 before the first one
 * @param {unknown} state `history.state` of the entry now shown
 * @returns {{depth:number, stamp:boolean}} stamp = the entry must be numbered
 */
export function entryDepth(prevDepth, state) {
  const dz = state !== null && typeof state === 'object' ? /** @type {any} */ (state).dz : undefined;
  if (Number.isInteger(dz) && dz >= 0) return { depth: dz, stamp: false };
  return { depth: Math.max(-1, prevDepth) + 1, stamp: true };
}

/** '#/note/abc?vista=mappa' */
export function buildHash(path, query) {
  const keys = query ? Object.keys(query) : [];
  const qs = keys.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join('&');
  return `#${path}${qs ? `?${qs}` : ''}`;
}
