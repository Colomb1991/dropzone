// @ts-check
// Address search as you type: first the door points the courier has learned, then the online
// service when it is on. Coordinates typed or pasted are a stop too.
import { html, useState, useEffect, useMemo } from '../../../ui/html.js';
import { t, format } from '../../../core/api.js';
import { useLive, useSetting, useStore } from '../../../ui/hooks.js';
import { Field, List, ListRow, Banner, Icon } from '../../../ui/kit/index.js';
import { normalizeAddress, searchDoorPoints, parseCoords, QUERY_MIN, QUERY_MAX } from '../logic/address.js';
import { listDoorPoints, searchOnline } from '../logic/data.js';

/** Typing pause before a request: above the 400 ms the gateway asks between two requests. */
const TYPING_PAUSE_MS = 450;
/** Typing pause before the one-time explanation interrupts. */
const ASK_PAUSE_MS = 900;
const IDLE = { q: '', state: 'idle', list: [] };

/**
 * @param {{onAdd:(input:object)=>void, onAskOnline:()=>void, busy:boolean}} props
 *   `onAskOnline` opens the one-time explanation of the online search
 */
export function SearchPane({ onAdd, onAskOnline, busy }) {
  const [text, setText] = useState('');
  const [photonOn] = useSetting('svc.photon');
  const [asked] = useSetting('giro.photonAsked');
  const online = useStore((s) => s.online);
  const sandbox = useStore((s) => s.sandbox);
  const { data: doors } = useLive(['doorPoints'], listDoorPoints);
  const [remote, setRemote] = useState(/** @type {{q:string, state:string, list:any[]}} */ (IDLE));
  const [retry, setRetry] = useState(0);

  const q = text.trim();
  const point = useMemo(() => parseCoords(q), [q]);
  const mine = useMemo(() => searchDoorPoints(q, doors ?? []), [q, doors]);
  const searchable = q.length >= QUERY_MIN && !point;
  const canAsk = searchable && photonOn === true && online && !sandbox;

  useEffect(() => {
    if (!canAsk) {
      setRemote(IDLE);
      return undefined;
    }
    let alive = true;
    const ctl = new AbortController();
    setRemote((r) => ({ q, state: 'loading', list: r.list }));
    const ask = (again) => searchOnline(q, { signal: ctl.signal }).then((list) => {
      if (alive) setRemote({ q, state: 'done', list });
    }, (err) => {
      if (!alive) return;
      // Too close to another request (a pasted list is running): one more try, then give up.
      if (err?.code === 'rate-limited' && again) timer = setTimeout(() => ask(false), TYPING_PAUSE_MS * 2);
      else setRemote({ q, state: 'error', list: [] });
    });
    let timer = setTimeout(() => ask(true), TYPING_PAUSE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
      ctl.abort();
    };
  }, [q, canAsk, retry]);

  // The first search with the service still off: explain once, after the courier stops typing.
  useEffect(() => {
    if (!searchable || photonOn === true || asked === true || sandbox) return undefined;
    const timer = setTimeout(onAskOnline, ASK_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [q, searchable, photonOn, asked, sandbox]);

  const pick = (input) => {
    onAdd(input);
    setText('');
  };
  const known = new Set(mine.map((p) => p.key));
  const found = remote.list.filter((s) => !known.has(normalizeAddress(s.label)));
  const nothing = searchable && mine.length === 0 && found.length === 0;
  const plus = html`<${Icon} name="plus" label=${t('giro.add.short')} />`;

  let status = null;
  if (!searchable) {
    status = !point && html`<p class="t-body-m t-muted">${t('giro.search.start')}</p>`;
  } else if (sandbox) {
    status = html`<p class="t-caption t-muted">${t('giro.search.demo')}</p>`;
  } else if (photonOn !== true) {
    status = html`<${Banner} tone="neutral" icon="info" text=${t('giro.search.off')}
      action=${{ label: t('core.action.activate'), onClick: onAskOnline }} />`;
  } else if (!online) {
    status = html`<${Banner} tone="neutral" icon="wifi-off" text=${t('giro.search.offline')} />`;
  } else if (remote.state === 'error') {
    status = html`<${Banner} tone="warning" icon="triangle-alert" text=${t('giro.search.error')}
      action=${{ label: t('core.action.retry'), onClick: () => setRetry((n) => n + 1) }} />`;
  } else if (remote.state === 'loading' && found.length === 0) {
    status = html`<p class="t-body-m t-muted" role="status">${t('giro.search.searching')}</p>`;
  } else if (remote.state === 'done' && nothing) {
    status = html`<div class="stack" role="status">
      <p class="t-body-m">${t('giro.search.none')}</p>
      <p class="t-caption t-muted">${t('giro.search.noneHint')}</p>
    </div>`;
  }

  return html`<div class="stack">
    <${Field} label=${t('giro.search.label')} value=${text} onInput=${setText} max=${QUERY_MAX}
      placeholder=${t('giro.search.placeholder')} helper=${t('giro.search.help')} autocomplete="off" />
    ${point && html`<${List}>
      <${ListRow} icon="crosshair" title=${t('giro.search.point', { coords: format.coords(point.lat, point.lon) })}
        sub=${point.label || t('giro.search.pointSub')} disabled=${busy}
        onClick=${() => pick({ lat: point.lat, lon: point.lon, label: point.label, src: 'coords', addr: null })}
        trailing=${plus} />
    <//>`}
    ${mine.length > 0 && html`
      <h2 class="section-title">${t('giro.search.mine')}</h2>
      <${List} label=${t('giro.search.mine')}>
        ${mine.map((p) => html`<${ListRow} key=${p.key} icon="star" tone="success" title=${p.label}
          tags=${[{ label: t('giro.src.door'), tone: 'success' }]} disabled=${busy} trailing=${plus}
          onClick=${() => pick({ lat: p.lat, lon: p.lon, label: p.label, src: 'door', addr: p.key })} />`)}
      <//>`}
    ${found.length > 0 && html`
      <h2 class="section-title">${t('giro.search.online')}</h2>
      <${List} label=${t('giro.search.online')}>
        ${found.map((s) => html`<${ListRow} key=${s.id} icon="map-pin" title=${s.label} sub=${s.sub || undefined}
          disabled=${busy} trailing=${plus}
          onClick=${() => pick({ lat: s.lat, lon: s.lon, label: s.label, src: 'address',
            addr: normalizeAddress(s.label) || null })} />`)}
      <//>
      <p class="t-caption t-muted">${t('giro.search.credit')}</p>`}
    ${status}
  </div>`;
}
