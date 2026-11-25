// Classic blocking script: theme and language before first paint (no flash). Keys are the mirrors
// written by core/db/db.js setMirror(): '<scope path>theme', '<scope path>lang'.
(function () {
  'use strict';
  var root = document.documentElement;
  var scope = new URL('./', document.baseURI).pathname;
  var COLORS = { light: '#EEEEEE', dark: '#111111', hc: '#FFFFFF' };
  var mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

  function read(name) {
    try {
      return localStorage.getItem(scope + name);
    } catch (err) {
      return null;
    }
  }

  function apply() {
    var saved = read('theme');
    // Dark first: 'auto' follows the phone, and falls back to dark where it cannot be read.
    var theme = saved === 'light' || saved === 'dark' || saved === 'hc' ? saved : (mq && !mq.matches ? 'light' : 'dark');
    // A shift-long "sun" override set by the shell wins until it is removed.
    if (root.dataset.themeLock) theme = root.dataset.themeLock;
    root.dataset.theme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', COLORS[theme]);
  }

  apply();
  var lang = read('lang');
  if (lang === 'it' || lang === 'en') root.lang = lang;

  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
  }
  // Another window changed the setting; this window's own changes arrive through dz:theme.
  addEventListener('storage', function (e) {
    if (e.key === scope + 'theme' || e.key === null) apply();
  });
  document.addEventListener('dz:theme', apply);
})();
