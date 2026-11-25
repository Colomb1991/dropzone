// @ts-check
// Editor of the quick numbers: up to five rows of name and number, saved together.
import { html, useState } from '../../../ui/html.js';
import { useAction } from '../../../ui/hooks.js';
import { Sheet, Button, Field, toast } from '../../../ui/kit/index.js';
import { t, settings, format } from '../../../core/api.js';
import { MAX_QUICK, NAME_MAX, quickFromForm, rowProblem } from '../logic/quick.js';

const EMPTY = { name: '', number: '' };

/** @param {{numbers:import('../logic/quick.js').QuickNumber[], onClose:()=>void}} props */
export function QuickSheet({ numbers, onClose }) {
  const [rows, setRows] = useState(() => (numbers.length
    ? numbers.map((q) => ({ name: q.name, number: format.phone(q.number) })) : [{ ...EMPTY }]));
  const value = quickFromForm(rows);

  const save = useAction(async () => {
    await settings.set('sos.quick', value);
    toast(t('sos.quick.saved'), { icon: 'check' });
    onClose();
  });
  const edit = (i, key) => (v) => setRows(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  const remove = (i) => () => setRows(rows.length > 1 ? rows.filter((r, j) => j !== i) : [{ ...EMPTY }]);

  const footer = html`<${Button} block label=${t('core.action.save')} disabled=${!value} busy=${save.busy}
    onClick=${save.run} />`;
  return html`<${Sheet} open title=${t('sos.quick.title')} onClose=${onClose} footer=${footer}>
    <div class="stack stack--lg">
      ${rows.map((r, i) => {
        const problem = rowProblem(r);
        return html`<div class="f-sos-quick" role="group" aria-label=${t('sos.quick.entry', { n: i + 1 })}>
          <${Field} label=${t('sos.contact.name')} value=${r.name} max=${NAME_MAX} placeholder=${t('sos.quick.namePh')}
            onInput=${edit(i, 'name')} error=${problem === 'name' ? t('sos.quick.nameMissing') : undefined} />
          <${Field} label=${t('sos.contact.number')} type="tel" inputmode="tel" value=${r.number}
            onInput=${edit(i, 'number')} error=${problem === 'number' ? t('sos.contact.bad') : undefined} />
          <${Button} variant="ghost" icon="trash-2" label=${t('sos.quick.remove')} onClick=${remove(i)} />
        </div>`;
      })}
      ${rows.length < MAX_QUICK
        ? html`<${Button} block variant="secondary" icon="plus" label=${t('sos.quick.more')}
            onClick=${() => setRows([...rows, { ...EMPTY }])} />`
        : html`<p class="t-caption t-muted">${t('sos.quick.max')}</p>`}
      <p class="t-caption t-muted">${t('sos.quick.notice')}</p>
    </div>
  <//>`;
}
