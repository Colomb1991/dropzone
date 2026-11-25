// @ts-check
// "Abituali": the addresses the courier has already delivered to, most used first. Tick the ones of
// today and add them in one go: each carries the point the phone measured, so nothing is searched.
import { html, useState, useEffect, useMemo, useRef } from '../../../ui/html.js';
import { t, tn } from '../../../core/api.js';
import { useLive, useAction } from '../../../ui/hooks.js';
import { Field, List, ListRow, Button, Empty, toast } from '../../../ui/kit/index.js';
import { QUERY_MAX } from '../logic/address.js';
import { usualStops, searchUsual, usualInputs } from '../logic/usual.js';
import { listDoorPoints, addStops } from '../logic/data.js';

const PAGE = 40;

/**
 * @param {{route:import('../logic/route.js').Route|undefined,
 *   onAction:(action:{count:number, run:()=>void, busy:boolean}|null)=>void}} props
 *   `onAction`: the screen shows "Aggiungi N fermate" in its bottom bar while something is ticked
 */
export function UsualPane({ route, onAction }) {
  const { data: doors, loading } = useLive(['doorPoints'], listDoorPoints);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const [limit, setLimit] = useState(PAGE);
  const all = useMemo(() => usualStops(doors ?? [], route), [doors, route]);
  const list = useMemo(() => searchUsual(all, query), [all, query]);
  // A stop that is already waiting in the route cannot be added twice.
  const chosen = useMemo(() => new Set(all.filter((u) => picked.has(u.id) && !u.waiting).map((u) => u.id)),
    [all, picked]);

  const add = useAction(async () => {
    const res = await addStops(usualInputs(all, chosen));
    setPicked(new Set());
    if (res.added) toast(tn('giro.added.n', res.added), { icon: 'check' });
    else toast(t(res.full ? 'giro.full' : 'giro.repeated'), { icon: 'info' });
  });
  const report = useRef(onAction);
  report.current = onAction;
  useEffect(() => {
    report.current(chosen.size ? { count: chosen.size, run: add.run, busy: add.busy } : null);
  }, [chosen.size, add.busy]);
  useEffect(() => () => report.current(null), []);

  const flip = (id) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  if (!loading && all.length === 0) {
    return html`<${Empty} icon="star" title=${t('giro.usual.empty')} text=${t('giro.usual.emptyText')} />`;
  }
  return html`<div class="stack">
    <${Field} label=${t('giro.usual.search')} value=${query} onInput=${(value) => setQuery(value.slice(0, QUERY_MAX))}
      placeholder=${t('giro.usual.placeholder')} helper=${t('giro.usual.help')} autocomplete="off" />
    ${loading && html`<p class="t-body-m t-muted" role="status">${t('core.state.loading')}</p>`}
    ${!loading && list.length === 0 && html`<p class="t-body-m t-muted" role="status">${t('giro.usual.none')}</p>`}
    ${list.length > 0 && html`<${List} label=${t('giro.mode.usual')}>
      ${list.slice(0, limit).map((u) => html`<${ListRow} key=${u.id} title=${u.label}
        sub=${u.learned ? tn('giro.usual.times', u.n) : t('giro.usual.today')}
        tags=${u.waiting ? [{ label: t('giro.notes.inRoute'), tone: 'success', icon: 'check' }] : undefined}
        selected=${chosen.has(u.id)} disabled=${u.waiting} dim=${u.waiting} onClick=${() => flip(u.id)} />`)}
    <//>`}
    ${list.length > limit && html`<${Button} variant="secondary" block label=${t('core.action.showMore')}
      onClick=${() => setLimit(limit + PAGE)} />`}
  </div>`;
}
