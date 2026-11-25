// @ts-check
// "Confronta con la busta paga" (SPEC 11): the courier types the hours printed on the payslip of
// the month shown; the sheet puts them next to the hours of the register. Hours only.
import { html, useState } from '../../../ui/html.js';
import { useSetting, useAction } from '../../../ui/hooks.js';
import { Sheet, Button, Field, List, ListRow, toast } from '../../../ui/kit/index.js';
import { t, format } from '../../../core/api.js';
import { ymKey, parseHours, hoursText, setPayslip, comparePayslip } from '../logic/payslip.js';

const dur = (min) => format.duration(min * 60000);

/** "8 h 20 in più nel tuo registro" · "Nessuna differenza" @param {ReturnType<typeof comparePayslip>} cmp */
export function diffText(cmp) {
  return cmp.more === 'even' ? t('ore.pay.even') : t(`ore.pay.more.${cmp.more}`, { d: dur(cmp.diffMin) });
}

/**
 * @param {{ym:{y:number, m:number}, workedMs:number, onClose:()=>void}} props
 *   `workedMs`: "Ore lavorate" of the month, from the register
 */
export function PayslipSheet({ ym, workedMs, onClose }) {
  const [all, setAll] = useSetting('ore.payslip');
  const key = ymKey(ym.y, ym.m);
  const saved = all?.[key] ?? null;
  const [ord, setOrd] = useState(() => (saved ? hoursText(saved.ord) : ''));
  const [extra, setExtra] = useState(() => (saved && saved.extra > 0 ? hoursText(saved.extra) : ''));

  const ordMin = parseHours(ord);
  const extraMin = extra.trim() === '' ? 0 : parseHours(extra);
  const entry = ordMin !== null && extraMin !== null ? { ord: ordMin, extra: extraMin } : null;
  const cmp = entry ? comparePayslip(workedMs, entry) : null;

  const save = useAction(async () => {
    if (!entry) return;
    await setAll(setPayslip(all ?? {}, key, entry));
    toast(t('ore.pay.saved'), { icon: 'check' });
    onClose();
  });
  const clear = useAction(async () => {
    await setAll(setPayslip(all ?? {}, key, null));
    toast(t('ore.pay.cleared'));
    onClose();
  });

  const footer = html`<div class="stack">
    <${Button} block label=${t('core.action.save')} disabled=${!entry} reason=${t('ore.pay.bad')} busy=${save.busy}
      onClick=${save.run} />
    ${saved && html`<${Button} block variant="ghost" icon="trash-2" label=${t('ore.pay.clear')} busy=${clear.busy}
      onClick=${clear.run} />`}
  </div>`;
  return html`<${Sheet} open title=${t('ore.pay.title', { month: format.monthTitle(ym.y, ym.m) })} onClose=${onClose}
    footer=${footer}>
    <div class="stack">
      <${List} label=${t('ore.pay.open')}>
        <${ListRow} title=${t('ore.pay.register')} value=${dur(Math.max(0, Math.round(workedMs / 60000)))} />
        ${cmp && html`<${ListRow} title=${t('ore.pay.payslip')} value=${dur(cmp.payslipMin)} />`}
        ${cmp && html`<${ListRow} title=${t('ore.pay.diff')} value=${dur(cmp.diffMin)} />`}
      <//>
      ${cmp && html`<p class="t-title-s" role="status">${diffText(cmp)}</p>`}
      <${Field} label=${t('ore.pay.ord')} value=${ord} inputmode="decimal" placeholder="168"
        helper=${t('ore.pay.help')} error=${ord.trim() !== '' && ordMin === null ? t('ore.pay.bad') : ''}
        onInput=${setOrd} />
      <${Field} label=${t('ore.pay.extra')} value=${extra} inputmode="decimal" placeholder="0"
        error=${extraMin === null ? t('ore.pay.bad') : ''} onInput=${setExtra} />
      <p class="t-caption t-muted">${t('ore.pay.caption')}</p>
    </div>
  <//>`;
}
