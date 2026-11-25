// @ts-check
// Ritmo (SPEC 11): the courier types how many deliveries are left, two or three times a shift, when
// stopped. The screen answers with a time back at the depot and the margin on the own day.
import { html, useState } from '../../../ui/html.js';
import { useLang, useSetting, useAction } from '../../../ui/hooks.js';
import { Screen, Button, Sheet, Keypad, List, ListRow, Stepper, Empty, toast } from '../../../ui/kit/index.js';
import { t, format, router, log } from '../../../core/api.js';
import { parseLeft, MAX_RETURN_MIN } from '../logic/pace.js';
import { saveCount, undoLast } from '../logic/data.js';
import { usePace, projectionLine } from '../parts/view.js';

export default function RitmoScreen() {
  useLang();
  const { shift, projection: pr, now, loading } = usePace();
  const [returnMin, setReturnMin] = useSetting('ritmo.returnMin');
  const [asking, setAsking] = useState(false);
  const [digits, setDigits] = useState('');

  const save = useAction(async () => {
    const left = parseLeft(digits);
    if (left === null) {
      toast(t('ritmo.ask.bad'), { icon: 'triangle-alert' });
      return;
    }
    await saveCount(left);
    setDigits('');
    setAsking(false);
    toast(t('ritmo.saved', { n: left }), { icon: 'check' });
  });
  const undo = useAction(async () => {
    const res = await undoLast();
    if (res.changed) toast(t('ritmo.undone'));
  });
  const closeAsk = () => {
    setAsking(false);
    setDigits('');
  };

  if (!shift || !pr) {
    return html`<${Screen} title=${t('ritmo.title')} back="/altro">
      <${Empty} icon="gauge" title=${t('ritmo.noShift.title')} text=${t('ritmo.noShift.text')} />
    <//>`;
  }
  if (loading) {
    return html`<${Screen} title=${t('ritmo.title')} back="/">
      <p class="loading" role="status">${t('core.state.loading')}</p>
    <//>`;
  }

  // Before the first count: the base is the first one taken on the road, at the first delivery.
  if (pr.state === 'empty') {
    return html`<${Screen} title=${t('ritmo.title')} back="/">
      <div class="stack">
        <p class="t-title-m">${t('ritmo.first')}</p>
        <h2 class="section-title">${t('ritmo.ask.first')}</h2>
        <${Keypad} value=${digits} max=${3} label=${t('ritmo.ask.first')} onChange=${setDigits} onDone=${save.run} />
        <p class="t-caption t-muted">${t('ritmo.caption')}</p>
      </div>
    <//>`;
  }

  const sticky = html`<${Button} block size="xl" icon="pencil" label=${t('ritmo.ask')} onClick=${() => setAsking(true)} />`;
  return html`<${Screen} title=${t('ritmo.title')} back="/" sticky=${sticky}>
    <div class="stack">
      <p class="t-title-l" role="status">${projectionLine(pr)}</p>
      ${pr.state === 'collecting' && html`<p class="t-body-m">${t('ritmo.collecting.need')}</p>`}
      ${pr.askAgain && html`<p class="t-body-m t-muted">${t('ritmo.askAgain', { ago: format.ago(pr.lastAt, now) })}</p>`}
      <${List} label=${t('ritmo.title')}>
        <${ListRow} title=${t('ritmo.row.left')} sub=${t('ritmo.row.leftAt', { time: format.time(pr.lastAt) })}
          value=${String(pr.left)} />
        ${pr.mps !== null && html`<${ListRow} title=${t('ritmo.row.pace')} value=${format.number(pr.mps, 1)} />`}
        <${ListRow} title=${t('ritmo.row.break')}
          value=${pr.breakLeftMin > 0 ? format.duration(pr.breakLeftMin * 60000) : t('ritmo.row.breakDone')} />
        ${pr.dayEndAt !== null && html`<${ListRow} title=${t('ritmo.row.dayEnd')} value=${format.time(pr.dayEndAt)} />`}
      <//>
      <${Stepper} label=${t('ritmo.return')} value=${returnMin} min=${0} max=${MAX_RETURN_MIN} step=${5}
        format=${(n) => t('core.fmt.min', { n })}
        onChange=${(v) => setReturnMin(v).catch((err) => log.error('ritmo', err))} />
      <${List}>
        ${pr.dayEndAt === null && html`<${ListRow} icon="settings" title=${t('ritmo.row.noContract')}
          sub=${t('ritmo.row.noContractSub')} chevron href=${router.href('/impostazioni')} />`}
        <${ListRow} icon="plus" title=${t('ritmo.plus.open')} sub=${t('ritmo.plus.openSub')} chevron
          href=${router.href('/ritmo/conta')} />
      <//>
      <${Button} block variant="ghost" icon="undo-2" label=${t('ritmo.undo')} busy=${undo.busy} onClick=${undo.run} />
      <p class="t-caption t-muted">${t('ritmo.caption')}</p>
    </div>
    ${asking && html`<${Sheet} open title=${t('ritmo.ask')} onClose=${closeAsk}>
      <${Keypad} value=${digits} max=${3} label=${t('ritmo.ask')} onChange=${setDigits} onDone=${save.run} />
    <//>`}
  <//>`;
}
