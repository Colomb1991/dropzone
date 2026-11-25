// @ts-check
import { html } from '../../../ui/html.js';
import { useLive, useLang, useSetting } from '../../../ui/hooks.js';
import { Card } from '../../../ui/kit/index.js';
import { t, router, format } from '../../../core/api.js';
import { loadWeek, weekLine } from './week-data.js';

/** Home outside a shift: "Questa settimana" → Ore (SPEC 2.4 row 3). */
export default function WeekCard() {
  useLang();
  const [weeklyHours] = useSetting('contract.weeklyHours');
  const [breakPaid] = useSetting('contract.breakPaid');
  const { data: w } = useLive(['shifts'], () => loadWeek(), [weeklyHours, breakPaid]);
  if (!w) return null;
  return html`<${Card} title=${t('ore.week.title')} icon="clock" href=${router.href('/ore')}>
    <p class="t-title-m num">${w.count > 0 ? weekLine(w) : t('ore.week.none')}</p>
    ${w.overMs > 0 && html`<p class="t-body-m">${t('ore.over', { d: format.duration(w.overMs) })}</p>`}
  <//>`;
}
