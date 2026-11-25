// @ts-check
import { useState, useEffect, useRef, useCallback } from './html.js';
import * as store from '../core/store.js';
import * as settings from '../core/settings.js';
import * as events from '../core/events.js';
import * as tick from '../core/tick.js';
import * as geo from '../core/geo/geo.js';
import * as slots from '../core/slots.js';
import * as cues from '../core/platform/cues.js';
import * as log from '../core/log.js';
import { now } from '../core/clock.js';
import { t } from '../core/i18n.js';
import { toUserKey } from '../core/errors.js';
import { toast } from './kit/toast.js';

/**
 * @template T
 * @param {(s: import('../core/types.js').AppState) => T} selector @returns {T}
 */
export function useStore(selector) {
  const sel = useRef(selector);
  sel.current = selector;
  const [value, setValue] = useState(() => selector(store.getState()));
  useEffect(() => {
    setValue(sel.current(store.getState()));
    return store.subscribe((s) => sel.current(s), (v) => setValue(() => v));
  }, []);
  return value;
}

/** @param {string} key @returns {[any, (v:any)=>Promise<void>]} */
export function useSetting(key) {
  const [value, setValue] = useState(() => settings.get(key));
  useEffect(() => {
    setValue(() => settings.get(key));
    return settings.onChange(key, () => setValue(() => settings.get(key)));
  }, [key]);
  const set = useCallback((v) => settings.set(key, v), [key]);
  return [value, set];
}

/** Subscribes a component to language changes. @returns {'it'|'en'} */
export function useLang() {
  return useStore((s) => s.lang);
}

/** @param {1000|5000|60000} [everyMs] @returns {number} now() */
export function useTick(everyMs = 1000) {
  const [at, setAt] = useState(() => now());
  useEffect(() => tick.onTick((n) => setAt(n), everyMs), [everyMs]);
  return at;
}

/** Re-renders at most once per second. @returns {import('../core/types.js').Fix|null} */
export function useFix() {
  const [fix, setFix] = useState(() => geo.lastFix());
  useEffect(() => {
    let lastAt = 0;
    return geo.onFix((f) => {
      const n = now();
      if (n - lastAt < 1000) return;
      lastAt = n;
      setFix(f);
    });
  }, []);
  return fix;
}

/**
 * Loads data and reloads on data:changed of the named stores.
 * @template T
 * @param {string[]} stores @param {() => Promise<T>} load @param {any[]} [deps]
 * @returns {{data:T|undefined, loading:boolean, error:unknown, reload():void}}
 */
export function useLive(stores, load, deps = []) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });
  const loader = useRef(load);
  loader.current = load;
  const seq = useRef(0);
  const reload = useCallback(() => {
    const mine = ++seq.current;
    loader.current().then(
      (data) => mine === seq.current && setState({ data, loading: false, error: null }),
      (error) => {
        log.error('live', error);
        if (mine === seq.current) setState((s) => ({ data: s.data, loading: false, error }));
      },
    );
  }, []);
  useEffect(() => {
    reload();
    const names = new Set(stores);
    const offChanged = events.on('data:changed', (e) => {
      if (names.has(e.store)) reload();
    });
    const offWiped = events.on('data:wiped', reload);
    return () => {
      seq.current++;
      offChanged();
      offWiped();
    };
  }, deps);
  return { ...state, reload };
}

/**
 * Wraps an async handler: ignores repeats within 300 ms and while busy, shows the error as a toast.
 * The wrapped function runs synchronously inside the click, so user activation is kept.
 * @param {(...a:any[]) => any} fn @param {{errorKey?:string, cue?:string}} [opts]
 * @returns {{run:(...a:any[])=>void, busy:boolean}}
 */
export function useAction(fn, opts = {}) {
  const [busy, setBusy] = useState(false);
  const ref = useRef({ fn, opts, busy: false, lastAt: -Infinity, alive: true });
  ref.current.fn = fn;
  ref.current.opts = opts;
  useEffect(() => () => {
    ref.current.alive = false;
  }, []);
  const run = useCallback((...args) => {
    const r = ref.current;
    const at = now();
    if (r.busy || at - r.lastAt < 300) return;
    r.lastAt = at;
    r.busy = true;
    setBusy(true);
    let job;
    try {
      job = Promise.resolve(r.fn(...args));
    } catch (err) {
      job = Promise.reject(err);
    }
    job.then(() => {
      if (r.opts.cue) cues.playCue(/** @type {any} */ (r.opts.cue));
    }, (err) => {
      log.error('action', err);
      toast(t(r.opts.errorKey ?? toUserKey(err)), { icon: 'triangle-alert' });
    }).then(() => {
      r.busy = false;
      if (r.alive) setBusy(false);
    });
  }, []);
  return { run, busy };
}

/** Contributions to a slot, re-read when the shift, the driving state or the language changes. */
export function useSlot(name) {
  useStore((s) => s.shift);
  useStore((s) => s.moving);
  useStore((s) => s.lang);
  return slots.items(name);
}

/**
 * Lazily loaded default export (screens, slot components).
 * @param {(() => Promise<{default:Function}>)|null|undefined} load
 * @returns {{Comp:Function|null, error:unknown}}
 */
export function useLazy(load) {
  const [state, setState] = useState({ Comp: null, error: null, load: null });
  useEffect(() => {
    if (!load) return undefined;
    let alive = true;
    load().then(
      (m) => alive && setState({ Comp: m.default, error: null, load }),
      (error) => {
        log.error('lazy', error);
        if (alive) setState({ Comp: null, error, load });
      },
    );
    return () => {
      alive = false;
    };
  }, [load]);
  return state.load === load ? { Comp: state.Comp, error: state.error } : { Comp: null, error: null };
}
