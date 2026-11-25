// @ts-check
// Checklist del furgone: ticked at the start of a diary session, stored with that session.
// The list itself is the courier's (at most 10 lines) and is edited here.
import { html, useEffect, useRef, useState } from '../../../ui/html.js';
import { Sheet, Button, Toggle, List, ListRow, Field } from '../../../ui/kit/index.js';
import { useSetting } from '../../../ui/hooks.js';
import { t, log } from '../../../core/api.js';
import {
  DEFAULT_ITEMS, MAX_ITEMS, MAX_LABEL, addItem, removeItem, checkRows, toggleCheck, checksSummary,
} from '../logic/checklist.js';

/** The courier's list, or the default one in the language of the app. */
export function useChecklist() {
  const [stored, setStored] = useSetting('furgone.checklist');
  const custom = Array.isArray(stored);
  /** @type {string[]} */
  const items = custom ? stored : DEFAULT_ITEMS.map((k) => t(`furgone.check.item.${k}`));
  return { items, custom, save: setStored };
}

/** "3 di 5 a posto" */
export function checksLine(checks) {
  return t('furgone.check.count', checksSummary(checks));
}

function EditList({ items, custom, onSave }) {
  const [text, setText] = useState('');
  const [problem, setProblem] = useState('');
  const save = (next) => onSave(next).catch((err) => log.error('furgone', err));
  const add = () => {
    const res = addItem(items, text);
    if (!res.ok) {
      setProblem(res.reason === 'empty' ? '' : t(`furgone.check.${res.reason}`));
      return;
    }
    setText('');
    setProblem('');
    save(res.items);
  };
  const full = items.length >= MAX_ITEMS;
  return html`<div class="stack">
    ${items.length === 0 && html`<p class="t-body-m t-muted">${t('furgone.check.empty')}</p>`}
    ${items.length > 0 && html`<${List} label=${t('furgone.check.editTitle')}>
      ${items.map((label, i) => html`<${ListRow} key=${label} title=${label}
        trailing=${html`<${Button} variant="ghost" iconOnly icon="trash-2"
          label=${t('furgone.check.remove', { label })} onClick=${() => save(removeItem(items, i))} />`} />`)}
    <//>`}
    ${!full && html`<${Field} label=${t('furgone.check.new')} value=${text} max=${MAX_LABEL} error=${problem}
      onInput=${(v) => {
        setText(v);
        setProblem('');
      }} />`}
    <${Button} block variant="secondary" icon="plus" label=${t('furgone.check.add')}
      disabled=${full || text.trim() === ''} reason=${full ? t('furgone.check.full') : undefined} onClick=${add} />
    ${custom && html`<${Button} block variant="ghost" icon="undo-2" label=${t('furgone.check.reset')}
      onClick=${() => save(null)} />`}
  </div>`;
}

/**
 * @param {{checks:import('../logic/checklist.js').Check[], onSave:(rows:import('../logic/checklist.js').Check[])=>void,
 *   onClose:()=>void}} props  `checks`: what the session of now already holds
 */
export function ChecklistSheet({ checks, onSave, onClose }) {
  const list = useChecklist();
  const [editing, setEditing] = useState(false);
  // This sheet is the only writer while it is open: its rows are the truth, saved at every tap.
  const [rows, setRows] = useState(() => checkRows(list.items, checks));
  const latest = useRef({ rows, onSave, touched: checks.length > 0 });
  latest.current.rows = rows;
  latest.current.onSave = onSave;
  const itemsKey = list.items.join('\n');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // The list was edited: same ticks, new lines. A session that already holds ticks follows it.
    const next = checkRows(list.items, latest.current.rows);
    setRows(next);
    if (latest.current.touched) latest.current.onSave(next);
  }, [itemsKey]);

  const tick = (i) => {
    const next = toggleCheck(rows, i);
    latest.current.touched = true;
    setRows(next);
    onSave(next);
  };
  const footer = editing
    ? html`<${Button} block size="xl" label=${t('core.action.done')} onClick=${() => setEditing(false)} />`
    : html`<div class="stack">
        <${Button} block size="xl" label=${t('core.action.done')} onClick=${onClose} />
        <${Button} block variant="ghost" icon="pencil" label=${t('furgone.check.edit')}
          onClick=${() => setEditing(true)} />
      </div>`;
  return html`<${Sheet} open title=${t(editing ? 'furgone.check.editTitle' : 'furgone.check.title')}
    onClose=${onClose} footer=${footer}>
    ${editing
      ? html`<${EditList} items=${list.items} custom=${list.custom} onSave=${list.save} />`
      : html`<div class="stack">
          ${rows.length === 0 && html`<p class="t-body-m t-muted">${t('furgone.check.empty')}</p>`}
          ${rows.length > 0 && html`<${List} label=${t('furgone.check.title')}>
            ${rows.map((c, i) => html`<${Toggle} key=${c.label} label=${c.label} checked=${c.ok}
              onChange=${() => tick(i)} />`)}
          <//>`}
          ${rows.length > 0 && html`<p class="t-title-s num" role="status">${checksLine(rows)}</p>`}
          <p class="t-caption t-muted">${t('furgone.check.caption')}</p>
        </div>`}
  <//>`;
}

/** History: the checklist as it was ticked in a past session. */
export function ChecksList({ checks }) {
  if (!checks || checks.length === 0) return null;
  return html`<div class="stack">
    <h3 class="section-title">${t('furgone.check.title')} · ${checksLine(checks)}</h3>
    <${List} label=${t('furgone.check.title')}>
      ${checks.map((c) => html`<${ListRow} key=${c.label} icon=${c.ok ? 'check' : 'minus'}
        tone=${c.ok ? 'success' : undefined} title=${c.label}
        sub=${t(c.ok ? 'furgone.check.ok' : 'furgone.check.todo')} />`)}
    <//>
  </div>`;
}
