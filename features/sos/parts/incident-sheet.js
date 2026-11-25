// @ts-check
// "Incidente col furgone": five steps to tick, in neutral words. A reminder, not legal advice.
// Nothing is stored: the ticks live only while the SOS screen is open.
import { html } from '../../../ui/html.js';
import { Sheet, LinkButton, List, ListRow } from '../../../ui/kit/index.js';
import { t, handoff } from '../../../core/api.js';
import { INCIDENT_STEPS, toggleStep } from '../logic/quick.js';

/** @param {{done:number[], onChange:(done:number[])=>void, onClose:()=>void}} props */
export function IncidentSheet({ done, onChange, onClose }) {
  const footer = html`<${LinkButton} variant="danger" size="xl" block icon="phone" label=${t('sos.call')}
    href=${handoff.telUrl('112')} />`;
  return html`<${Sheet} open title=${t('sos.incident.title')} onClose=${onClose} footer=${footer}>
    <div class="stack f-sos-steps">
      <${List} label=${t('sos.incident.title')}>
        ${INCIDENT_STEPS.map((s) => html`<${ListRow} key=${s.id} icon=${s.icon} selected=${done.includes(s.id)}
          title=${t(`sos.incident.${s.id}`)} sub=${t(`sos.incident.${s.id}s`)}
          onClick=${() => onChange(toggleStep(done, s.id))} />`)}
      <//>
      <p class="t-caption t-muted">${t('sos.incident.caption')}</p>
    </div>
  <//>`;
}
