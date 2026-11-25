// @ts-check
// JSDoc typedefs only (SPEC 7.1, ARCHITECTURE 0.0 and section 2). Every *At is epoch ms.

/** @typedef {import('./pure/catalog.js').Tone} Tone */
/** @typedef {null | {days:number[], windows:{from:string, to:string}[]}} Schedule */
/** @typedef {import('./pure/visits.js').Visit} Visit */

/** @typedef {{lat:number, lon:number, acc:number, speed:number|null, heading:number|null, ts:number,
 *   sim?:boolean}} RawFix */
/** @typedef {{lat:number, lon:number, acc:number, speed:number|null, heading:number|null, ts:number,
 *   headingTs:number|null, usable:boolean, sim:boolean}} Fix  speed in m/s */
/** @typedef {{id:'real'|'sim',
 *   watch(onRaw:(f:RawFix)=>void, onError:(code:'denied'|'unavailable'|'timeout')=>void): ()=>void,
 *   getOnce(opts:{timeoutMs:number, maxAgeMs:number}): Promise<RawFix>}} GeoProvider */

/** @typedef {{id:string, lat:number, lon:number, acc:number|null, cat:string, text:string,
 *   schedule:Schedule, photoId:string|null, private:boolean, biz:boolean, visits:Visit[],
 *   origin:'mine'|'received', packName:string|null, importId:string|null,
 *   createdAt:number, updatedAt:number, localEditAt:number|null}} Note */
/** @typedef {{noteId:string, lastFiredAt:number|null, mutedUntil:number|null}} NoteState */
/** @typedef {{id:string, kind:'photo'|'van', mime:string, bytes:ArrayBuffer, w:number, h:number,
 *   createdAt:number}} Media */
/** @typedef {{startAt:number, endAt:number|null, plannedMin:number,
 *   auto?:boolean          // closed by the app at its planned end
 * }} ShiftBreak */
/** @typedef {{id:string, startAt:number, endAt:number|null, mode:'holder'|'pocket', breaks:ShiftBreak[],
 *   edited:boolean, alertsFired:number, lastSeenAt:number}} Shift */

/** @typedef {{id:string, source:string, lat:number, lon:number,
 *   cls:'approach'|'stop'|'none',
 *   fixedRadiusM:number|null,           // null → settings radius with lead time; 300 for colleague alerts
 *   tone:Tone, output:'voice'|'sound'|'silent', schedule:Schedule,
 *   cooldown:'shift'|'once'|number|null, // null → 'shift'
 *   lastFiredAt:number|null, mutedUntil:number|null,
 *   stopSay?:string|null                // stop class: the one word spoken at the stop ("Cane.")
 * }} ProxTarget */
/** @typedef {{id:string,
 *   load: () => Promise<ProxTarget[]>,
 *   watch: string[],
 *   card: (targetId:string, ctx:{distM:number, now:number}) => Promise<AlertCardModel|null>,
 *   onFired: (targetId:string, at:number) => Promise<void>,
 *   onMuted: (targetId:string, until:number|null) => Promise<void>}} ProxSource */
/** @typedef {{id:string, source:string, tone:Tone, icon:string, title:string, text:string, meta:string,
 *   prefix?:string, distM:number, photoId?:string|null, speakText:string|null, lang:'it'|'en'}} AlertCardModel */

/** @typedef {{
 *  ready:boolean, lang:'it'|'en', theme:'light'|'dark'|'hc', online:boolean, sandbox:boolean,
 *  primary:boolean, shift:Shift|null, onBreak:boolean, moving:boolean, fast:boolean, passenger:boolean,
 *  gps:{state:'off'|'starting'|'ok'|'imprecise'|'coarse'|'paused'|'denied'|'unavailable', acc:number|null},
 *  wake:'off'|'native'|'none', audio:'locked'|'ok'|'off', voice:'locked'|'ok'|'none'|'off',
 *  lastAlert:{card:AlertCardModel, at:number}|null, updateReady:boolean,
 *  storage:{persisted:boolean|null, pct:number}
 * }} AppState */

/** @typedef {{name:string, keyPath:string, autoIncrement?:boolean,
 *   indexes?:{name:string, keyPath:string, unique?:boolean}[],
 *   since:number, backup:'always'|'never'|'optional',
 *   validate:(rec:unknown)=>object|null,
 *   upgrades?:Record<number,(rec:object)=>object|null>}} StoreDef */
/** @typedef {{index?:string, eq?:any, from?:any, to?:any, limit?:number, reverse?:boolean}} Query */
/** @typedef {{get(store:string, key:any):Promise<any>, getAll(store:string, q?:Query):Promise<any[]>,
 *   count(store:string, q?:Query):Promise<number>, put(store:string, rec:object):Promise<any>,
 *   del(store:string, key:any):Promise<void>, clear(store:string):Promise<void>}} Tx */

/** @typedef {{path:string, load:()=>Promise<{default:Function}>, titleKey:string,
 *   chrome?:'tabs'|'back'|'none', open?:boolean, whileMoving?:boolean}} RouteDef */
/** @typedef {{slot:string, order:number, featureId?:string, visible?:()=>boolean,
 *   load?:()=>Promise<{default:Function}>, provide?:(ctx:object)=>Promise<object[]>}} SlotItem */

export {};
