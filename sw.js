// version: 0.1.0+ddc248c3
// Classic service worker. The line above is rewritten by tools/release.mjs so this script changes
// byte-wise with every release. Cache names equal core/env.js cacheName(): '<scope path><kind>'.
'use strict';

importScripts('./precache-manifest.js');

var PRECACHE = self.__PRECACHE || { version: 'dev', files: [] };
var SCOPE_URL = new URL('./', self.location.href).href;
var SCOPE_PATH = new URL(SCOPE_URL).pathname;
var APP_PREFIX = SCOPE_PATH + 'app|';
var APP_CACHE = APP_PREFIX + PRECACHE.version;
var TILES_CACHE = SCOPE_PATH + 'tiles';
var META_CACHE = SCOPE_PATH + 'meta';
var HASHES_URL = './__hashes.json';
var TILE_HOST = 'tiles.openfreemap.org';
// Must equal core/net/services.js and the CSP connect-src (tests/audit/csp.test.mjs).
var ALLOWED_HOSTS = ['tiles.openfreemap.org', 'overpass.private.coffee', 'overpass-api.de', 'photon.komoot.io', 'api.open-meteo.com'];
var TILE_CAP = 1500;
var NETWORK_ONLY = ['sw.js', 'precache-manifest.js'];

var precached = new Set(PRECACHE.files.map(function (f) { return f[0].replace(/^\.\//, ''); }));
var tilesAllowed = true;
var tileWrites = 0;

/**
 * Pure routing table (ARCHITECTURE 3, with the Release 1 changes of 0.0).
 * @param {{method:string, url:string, mode:string, scope:string}} req  scope = the registration scope URL
 * @param {(rel:string)=>boolean} [has] is this in-scope path in the precache?
 * @returns {'pass'|'shell'|'network'|'precache'|'tilejson'|'tiles'|'block'}
 */
function routeRequest(req, has) {
  var inPrecache = has || function (rel) { return precached.has(rel); };
  if (req.method !== 'GET') return 'pass';
  var url = new URL(req.url);
  var scope = new URL(req.scope);
  if (url.origin === scope.origin) {
    if (url.pathname.indexOf(scope.pathname) !== 0) return 'pass';
    if (req.mode === 'navigate') return 'shell';
    var rel = url.pathname.slice(scope.pathname.length);
    if (NETWORK_ONLY.indexOf(rel) !== -1) return 'network';
    // Files outside the precache (the regional data packs) go to the network untouched.
    return inPrecache(rel) ? 'precache' : 'pass';
  }
  if (url.protocol === 'https:' && url.host === TILE_HOST) {
    if (!tilesAllowed) return 'block';
    return url.pathname === '/planet' ? 'tilejson' : 'tiles';
  }
  if (url.protocol === 'https:' && ALLOWED_HOSTS.indexOf(url.host) !== -1) return 'pass';
  // Egress fence for anything the page's CSP does not cover (workers).
  return 'block';
}

function hex(buf) {
  return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
}

async function sha256(buf) {
  return hex(await crypto.subtle.digest('SHA-256', buf));
}

async function readHashes(cache) {
  try {
    var res = await cache.match(HASHES_URL);
    return res ? await res.json() : {};
  } catch (err) {
    return {};
  }
}

async function precacheAll() {
  var cache = await caches.open(APP_CACHE);
  var have = await readHashes(cache);
  var older = [];
  var names = await caches.keys();
  for (var i = 0; i < names.length; i++) {
    if (names[i].indexOf(APP_PREFIX) === 0 && names[i] !== APP_CACHE) {
      var c = await caches.open(names[i]);
      older.push({ cache: c, hashes: await readHashes(c) });
    }
  }
  try {
    for (var k = 0; k < PRECACHE.files.length; k++) {
      var path = PRECACHE.files[k][0];
      var hash = PRECACHE.files[k][1];
      // Resume: already stored by an earlier, interrupted install of this same version.
      if (have[path] === hash && await cache.match(path)) continue;
      var res = null;
      for (var j = 0; j < older.length && !res; j++) {
        if (older[j].hashes[path] === hash) res = (await older[j].cache.match(path)) || null;
      }
      if (!res) {
        var fresh = await fetch(new Request(path, { cache: 'reload' }));
        if (fresh.status !== 200) throw new Error('precache ' + path + ' ' + fresh.status);
        // The CDN can serve a mix of old and new files for some minutes: refuse and retry later.
        if (await sha256(await fresh.clone().arrayBuffer()) !== hash) throw new Error('hash ' + path);
        res = fresh;
      }
      await cache.put(path, res);
      have[path] = hash;
    }
  } finally {
    await cache.put(HASHES_URL, new Response(JSON.stringify(have), { headers: { 'Content-Type': 'application/json' } }));
  }
}

async function cleanOld() {
  var names = await caches.keys();
  await Promise.all(names.filter(function (n) { return n.indexOf(APP_PREFIX) === 0 && n !== APP_CACHE; })
    .map(function (n) { return caches.delete(n); }));
}

async function fromShell(request) {
  var cache = await caches.open(APP_CACHE);
  return (await cache.match('./index.html')) || fetch(request);
}

async function fromPrecache(request) {
  var cache = await caches.open(APP_CACHE);
  var hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  try {
    return await fetch(request);
  } catch (err) {
    return Response.error();
  }
}

async function tileJson(request) {
  var cache = await caches.open(META_CACHE);
  try {
    var res = await Promise.race([
      fetch(request),
      new Promise(function (resolve, reject) { setTimeout(function () { reject(new Error('timeout')); }, 3000); }),
    ]);
    if (res.status === 200) await cache.put(request, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(request)) || Response.error();
  }
}

async function trimTiles(cache) {
  var keys = await cache.keys();
  for (var i = 0; i < keys.length - TILE_CAP; i++) await cache.delete(keys[i]);
}

// Only what the user's own map view asked for is kept: no prefetch, no bulk download.
async function tile(request) {
  var cache = await caches.open(TILES_CACHE);
  var hit = await cache.match(request);
  if (hit) return hit;
  try {
    var res = await fetch(request);
    if (res.status === 200) {
      await cache.put(request, res.clone());
      if (++tileWrites % 50 === 0) trimTiles(cache);
    }
    return res;
  } catch (err) {
    return Response.error();
  }
}

self.addEventListener('install', function (event) {
  // No skipWaiting here: the page decides when to switch (never during a shift).
  event.waitUntil(precacheAll());
});

self.addEventListener('activate', function (event) {
  event.waitUntil(cleanOld().then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (event) {
  var data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  else if (data.type === 'GET_VERSION' && event.ports && event.ports[0]) event.ports[0].postMessage({ version: PRECACHE.version });
  else if (data.type === 'TILES') tilesAllowed = data.allowed !== false;
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var strategy = routeRequest({ method: request.method, url: request.url, mode: request.mode, scope: SCOPE_URL });
  if (strategy === 'pass') return;
  if (strategy === 'block') event.respondWith(Response.error());
  else if (strategy === 'shell') event.respondWith(fromShell(request));
  else if (strategy === 'network') event.respondWith(fetch(request));
  else if (strategy === 'precache') event.respondWith(fromPrecache(request));
  else if (strategy === 'tilejson') event.respondWith(tileJson(request));
  else event.respondWith(tile(request));
});
