// @ts-check
import { html } from '../html.js';
import { useSlot, useLazy } from '../hooks.js';

function SlotItem({ item, props }) {
  const { Comp } = useLazy(item.load);
  return Comp ? html`<${Comp} ...${props} />` : null;
}

/** Renders every component contributed to a slot, in order. @param {{name:string, props?:object}} p */
export function SlotOutlet({ name, props = {} }) {
  const items = useSlot(name).filter((s) => typeof s.load === 'function');
  return items.map((item) => html`<${SlotItem} key=${`${item.featureId}:${item.order}`} item=${item} props=${props} />`);
}
