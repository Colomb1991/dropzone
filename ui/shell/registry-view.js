// @ts-check
// What the shell knows about the features. boot.js fills it once from features/registry.js
// (only boot.js may import the registry).
import * as log from '../../core/log.js';

/** @type {any[]} */
let navItems = [];

/** @param {{id:string, nav?:any[]}[]} features */
export function setFeatures(features) {
  navItems = features.flatMap((f) => (f.nav ?? []).map((n) => ({ ...n, featureId: f.id })))
    .sort((a, b) => a.order - b.order);
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
