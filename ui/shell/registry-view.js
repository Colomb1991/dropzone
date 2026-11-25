// @ts-check
// What the shell knows about the features. boot.js fills it once from features/registry.js
// (only boot.js may import the registry).
import * as log from '../../core/log.js';

/** @type {any[]} */
let navItems = [];
/** Route definition → the section it belongs to. @type {Map<object, {id:string, icon:string|null, root:boolean}>} */
let owners = new Map();

/** @param {{id:string, nav?:any[]}[]} features */
export function setFeatures(features) {
  navItems = features.flatMap((f) => (f.nav ?? []).map((n) => ({ ...n, featureId: f.id })))
    .sort((a, b) => a.order - b.order);
  owners = new Map();
  for (const f of features) {
    // The first route of a feature is the screen of the section; the home ("/") is nobody's section.
    const icon = /** @type {any} */ (f).nav?.[0]?.icon ?? null;
    (/** @type {any} */ (f).routes ?? []).forEach((r, i) => owners.set(r, { id: f.id, icon, root: i === 0 && r.path !== '/' }));
  }
}

/** The section a route belongs to (for the icon in the header of its screen), or null. */
export function sectionOf(def) {
  return (def && owners.get(def)) ?? null;
}

function shown(n) {
  try {
    return n.visible ? n.visible() !== false : true;
  } catch (err) {
    log.error('nav', err, { feature: n.featureId });
    return false;
  }
}

/** The bottom tabs, at most four. */
export function tabItems() {
  return navItems.filter((n) => n.place === 'tab' && shown(n)).slice(0, 4);
}

/** Rows of the "Altro" screen. */
export function moreItems() {
  return navItems.filter((n) => n.place === 'more' && shown(n));
}
