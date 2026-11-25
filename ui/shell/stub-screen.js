// @ts-check
import { html } from '../html.js';
import { t } from '../../core/i18n.js';
import { Screen } from '../kit/screen.js';
import { Empty } from '../kit/empty.js';

/**
 * Placeholder for a route whose feature package is not delivered yet.
 * @param {{title:string, icon?:string, back?:boolean|string, text?:string}} props
 */
export function StubScreen({ title, icon = 'traffic-cone', back, text }) {
  return html`<${Screen} title=${title} back=${back}>
    <${Empty} icon=${icon} title=${t('ui.stub.title')} text=${text ?? t('ui.stub.text')} />
  <//>`;
}
