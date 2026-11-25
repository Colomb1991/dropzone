// @ts-check
// navigator.geolocation. Never navigator.permissions.query: the prompt comes from a user action.
const WATCH = { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 };

/** @param {GeolocationPosition} p @returns {import('../types.js').RawFix} */
function toRaw(p) {
  const c = p.coords;
  return { lat: c.latitude, lon: c.longitude, acc: c.accuracy, speed: c.speed, heading: c.heading, ts: p.timestamp };
}

const code = (e) => (e?.code === 1 ? 'denied' : e?.code === 3 ? 'timeout' : 'unavailable');

/** @returns {import('../types.js').GeoProvider} */
export function createRealProvider() {
  const geo = () => (typeof navigator !== 'undefined' ? navigator.geolocation : undefined);
  return {
    id: 'real',
    watch(onRaw, onError) {
      const g = geo();
      if (!g) {
        onError('unavailable');
        return () => {};
      }
      const id = g.watchPosition((p) => onRaw(toRaw(p)), (e) => onError(code(e)), WATCH);
      return () => g.clearWatch(id);
    },
    getOnce(opts) {
      return new Promise((resolve, reject) => {
        const g = geo();
        if (!g) {
          reject(new Error('unavailable'));
          return;
        }
        g.getCurrentPosition((p) => resolve(toRaw(p)), (e) => reject(new Error(code(e))),
          { enableHighAccuracy: true, maximumAge: opts.maxAgeMs, timeout: opts.timeoutMs });
      });
    },
  };
}
