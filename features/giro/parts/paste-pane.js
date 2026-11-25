// @ts-check
// A pasted list of addresses, one per line: resolved one by one with progress, and the lines nobody
// knows are left in the box to fix.
import { html, useState, useEffect, useMemo, useRef } from '../../../ui/html.js';
import { t, tn, clipboard, log } from '../../../core/api.js';
import { useSetting, useStore } from '../../../ui/hooks.js';
import { Field, Button, Icon, toast } from '../../../ui/kit/index.js';
import { parsePaste, resolveItems } from '../logic/address.js';
import { listDoorPoints, searchOnline, onlineSearchState, addStops } from '../logic/data.js';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {{onAskOnline:()=>void, moving:boolean}} props */
export function PastePane({ onAskOnline, moving }) {
  const [text, setText] = useState('');
  const [job, setJob] = useState(/** @type {{done:number, total:number}|null} */ (null));
  const [result, setResult] = useState(/** @type {any} */ (null));
  const [photonOn] = useSetting('svc.photon');
  const [asked] = useSetting('giro.photonAsked');
  const sandbox = useStore((s) => s.sandbox);
  const halt = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);

  const parsed = useMemo(() => parsePaste(text), [text]);
  const count = parsed.items.length;
  const hasAddress = parsed.items.some((it) => it.kind === 'address');

  const fromClipboard = () => {
    // First statement of the tap: reading the clipboard needs the user activation.
    clipboard.readText().then((clip) => {
      if (!clip || !clip.trim()) toast(t('giro.paste.clipboardEmpty'), { icon: 'info' });
      else setText((cur) => (cur.trim() ? `${cur.trimEnd()}\n${clip}` : clip));
    });
  };

  const run = async () => {
    // The first search with the service still off: explain once; the courier then taps again.
    if (hasAddress && photonOn !== true && asked !== true && !sandbox) {
      onAskOnline();
      return;
    }
    halt.current = false;
    setResult(null);
    setJob({ done: 0, total: count });
    try {
      const res = await resolveItems(parsed.items, {
        doorPoints: await listDoorPoints(),
        online: onlineSearchState().allowed ? (line) => searchOnline(line) : null,
        wait: pause,
        onProgress: (done, total) => alive.current && setJob({ done, total }),
        stopped: () => halt.current || !alive.current,
      });
      // Whatever was found is added, also when the courier stopped or left the screen.
      const out = res.stops.length ? await addStops(res.stops) : { added: 0, repeated: 0, full: 0 };
      if (!alive.current) return;
      setText([...res.missing, ...res.left].join('\n'));
      setResult({ added: out.added, repeated: out.repeated, full: out.full, missing: res.missing.length,
        learned: res.learned, down: res.missing.length ? res.down : null, over: parsed.over });
    } catch (err) {
      log.error('giro', err);
      if (alive.current) toast(t('core.err.generic'), { icon: 'triangle-alert' });
    } finally {
      if (alive.current) setJob(null);
    }
  };

  if (job) {
    const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
    return html`<div class="f-giro-result" role="status">
      <p class="f-giro-result__line">${t('giro.paste.progress', job)}</p>
      <div class="f-giro-bar" role="progressbar" aria-label=${t('giro.paste.progress', job)} aria-valuemin="0"
        aria-valuemax=${job.total} aria-valuenow=${job.done}>
        <span class="f-giro-bar__fill" style=${{ width: `${pct}%` }}></span>
      </div>
      <p class="t-caption t-muted">${t('giro.paste.slow')}</p>
      <${Button} variant="secondary" icon="square" label=${t('giro.paste.stop')} onClick=${() => {
        halt.current = true;
      }} />
    </div>`;
  }

  const missingWhy = result?.down === 'offline' ? 'giro.paste.missingOffline'
    : result?.down === 'service-off' ? 'giro.paste.missingOff' : null;
  return html`<div class="stack">
    ${result && html`<div class="f-giro-result" role="status">
      <p class="f-giro-result__line" data-tone=${result.added ? 'success' : 'neutral'}>
        <${Icon} name=${result.added ? 'check' : 'info'} />
        <span>${result.added ? tn('giro.added.n', result.added) : t('giro.added.none')}</span>
      </p>
      ${result.learned > 0 && html`<p class="t-body-m t-muted">${tn('giro.paste.learned', result.learned)}</p>`}
      ${result.repeated > 0 && html`<p class="t-body-m t-muted">${tn('giro.repeated.n', result.repeated)}</p>`}
      ${result.full > 0 && html`<p class="t-body-m t-muted">${t('giro.full')}</p>`}
      ${result.over > 0 && html`<p class="t-body-m t-muted">${t('giro.paste.over')}</p>`}
      ${result.missing > 0 && html`
        <p class="f-giro-result__line" data-tone="warning">
          <${Icon} name="triangle-alert" /><span>${tn('giro.paste.missing', result.missing)}</span>
        </p>
        <p class="t-body-m t-muted">${missingWhy ? t(missingWhy) : ''} ${t('giro.paste.missingHelp')}</p>
        ${result.down === 'service-off' && !sandbox && html`<${Button} variant="secondary" icon="search"
          label=${t('giro.photon.on')} onClick=${onAskOnline} />`}`}
    </div>`}
    <div class="f-giro-paste">
      <${Field} type="textarea" label=${t('giro.paste.label')} value=${text} onInput=${setText}
        placeholder=${t('giro.paste.placeholder')} helper=${t('giro.paste.help')} autocomplete="off" />
    </div>
    <${Button} block variant="secondary" icon="clipboard-list" label=${t('giro.paste.clipboard')}
      onClick=${fromClipboard} />
    <${Button} block size="xl" icon="search" disabled=${count === 0 || moving}
      label=${count ? tn('giro.paste.run', count) : t('giro.paste.runEmpty')} onClick=${run} />
  </div>`;
}
