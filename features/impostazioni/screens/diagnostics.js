// @ts-check
// Diagnostica (SPEC 3.2): one "Prova" per platform risk, manual rows answered with Sì / No,
// and "Copia risultati" (no positions, no note text).
import { html, useEffect, useState } from '../../../ui/html.js';
import { Screen, Button, LinkButton, Icon, toast } from '../../../ui/kit/index.js';
import { useLang } from '../../../ui/hooks.js';
import {
  t, config, clock, env, i18n, log, errors, slots, clipboard, handoff, speech,
} from '../../../core/api.js';
import { reportText } from '../logic/diagnostics.js';
import { builtinRows, mergeRows } from '../logic/diag-rows.js';

const TONE = { true: 'success', false: 'danger', null: 'neutral' };
const ICON = { true: 'check', false: 'triangle-alert', null: 'info' };

/** @param {{row:any, res:any, onRun:()=>void, onAnswer:(yes:boolean)=>void}} props */
function Row({ row, res, onRun, onAnswer }) {
  const done = res?.status === 'done';
  const mark = String(done ? res.ok : null);
  const text = t('impostazioni.sos.testText');
  return html`<li class="f-imp-diag" data-tone=${done ? TONE[mark] : null}>
    <div class="f-imp-diag__text">
      <span class="f-imp-diag__label">${t(row.labelKey)}</span>
      ${row.hintKey && html`<span class="f-imp-diag__hint">${t(row.hintKey)}</span>`}
      ${done && html`<span class="f-imp-diag__result" role="status">
        <${Icon} name=${ICON[mark]} /><span>${res.text}</span>
      </span>`}
    </div>
    ${row.links && html`<div class="btn-row f-imp-diag__wide">
      <${LinkButton} external variant="secondary" label=${t('impostazioni.sos.whatsapp')}
        href=${handoff.whatsappUrl(text)} />
      <${LinkButton} variant="secondary" label=${t('impostazioni.sos.sms')} href=${handoff.smsUrl('', text)} />
    </div>`}
    ${row.manual
      ? html`<div class="btn-row f-imp-diag__wide">
          <${Button} variant="secondary" label=${t('impostazioni.diag.yes')} onClick=${() => onAnswer(true)} />
          <${Button} variant="secondary" label=${t('impostazioni.diag.no')} onClick=${() => onAnswer(false)} />
        </div>`
      : html`<${Button} variant="secondary" label=${t('impostazioni.diag.run')} busy=${res?.status === 'running'}
          icon=${res?.status === 'running' ? 'refresh-cw' : undefined} onClick=${onRun} />`}
  </li>`;
}

export default function DiagnosticsScreen() {
  useLang();
  const [rows, setRows] = useState(() => builtinRows());
  const [results, setResults] = useState(/** @type {Record<string, any>} */ ({}));
  useEffect(() => {
    let alive = true;
    // Voices load late on some phones: asking once makes them ready for the Voce row.
    speech.voiceInfo(i18n.getLang());
    slots.collect('diagnostics', {}).then((extra) => alive && setRows(mergeRows(builtinRows(), extra)),
      () => log.warn('diag', 'slot-failed'));
    return () => {
      alive = false;
    };
  }, []);

  const set = (id, value) => setResults((cur) => ({ ...cur, [id]: value }));
  const run = (row) => () => {
    let job;
    try {
      // Called inside the tap: camera, sound, speech and the wake lock need the user activation.
      job = Promise.resolve(row.run());
    } catch (err) {
      job = Promise.reject(err);
    }
    set(row.id, { status: 'running' });
    job.then((r) => set(row.id, { status: 'done', ok: r?.ok ?? null, text: String(r?.text ?? '') }), (err) => {
      log.error('diag', err, { row: row.id });
      set(row.id, { status: 'done', ok: false, text: t(errors.toUserKey(err)) });
    });
  };
  const answer = (row) => (yes) => set(row.id,
    { status: 'done', ok: yes, text: t(yes ? 'impostazioni.diag.yes' : 'impostazioni.diag.no') });

  const copy = () => {
    const ios = env.iosVersion();
    const text = reportText({
      title: `${t('core.app.name')} ${config.APP_VERSION}`,
      meta: [
        [t('impostazioni.diag.meta.date'), new Date(clock.now()).toISOString()],
        [t('impostazioni.diag.meta.system'), `${env.os()}${ios ? ` ${ios.join('.')}` : ''} · ${i18n.getLang()}`],
        [t('impostazioni.diag.meta.browser'), typeof navigator === 'undefined' ? '' : navigator.userAgent],
      ],
      rows: rows.map((row) => {
        const res = results[row.id];
        return { label: t(row.labelKey), ok: res?.status === 'done' ? res.ok : null,
          text: res?.status === 'done' ? res.text : t('impostazioni.diag.notRun') };
      }),
      log: log.entries(),
    });
    clipboard.copyText(text).then((ok) => toast(t(ok ? 'core.action.copied' : 'impostazioni.diag.copyFailed'),
      { icon: ok ? 'check' : 'triangle-alert' }));
  };

  return html`<${Screen} title=${t('impostazioni.diagnostica')} back="/impostazioni"
    sticky=${html`
      <${Button} block icon="copy" label=${t('impostazioni.diag.copy')} onClick=${copy} />
      <p class="t-caption t-muted t-center">${t('impostazioni.diag.copyNote')}</p>`}>
    <p class="t-body-m t-muted">${t('impostazioni.diag.intro')}</p>
    <ul class="f-imp-diags">
      ${rows.map((row) => html`<${Row} key=${row.id} row=${row} res=${results[row.id]} onRun=${run(row)}
        onAnswer=${answer(row)} />`)}
    </ul>
  <//>`;
}
