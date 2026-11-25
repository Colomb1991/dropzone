// @ts-check
// Ritmo, +1 mode (DESIGN 8.10): one large button, one tap for every delivery done. Optional, and on
// its own screen so the main one stays a place for two or three counts a shift. The route is not
// usable while the van moves (the shell locks it), so every tap happens at a stop.
import { html } from '../../../ui/html.js';
import { useLang, useAction } from '../../../ui/hooks.js';
import { Screen, Button, Empty } from '../../../ui/kit/index.js';
import { t, router, cues } from '../../../core/api.js';
import { plusOne, minusOne } from '../logic/data.js';
import { usePace, projectionLine } from '../parts/view.js';

export default function CountScreen() {
  useLang();
  const { shift, pace, projection: pr, loading } = usePace();
  const plus = useAction(async () => {
    const res = await plusOne();
    if (res.changed) cues.haptic('saved');
  });
  const minus = useAction(() => minusOne());

  if (!shift || !pr) {
    return html`<${Screen} title=${t('ritmo.plus.title')} back="/ritmo">
      <${Empty} icon="gauge" title=${t('ritmo.noShift.title')} text=${t('ritmo.noShift.text')} />
    <//>`;
  }
  if (loading) {
    return html`<${Screen} title=${t('ritmo.plus.title')} back="/ritmo">
      <p class="loading" role="status">${t('core.state.loading')}</p>
    <//>`;
  }
  if (pr.state === 'empty' || pr.left === null) {
    return html`<${Screen} title=${t('ritmo.plus.title')} back="/ritmo">
      <${Empty} icon="gauge" title=${t('ritmo.plus.none')}
        action=${{ label: t('ritmo.ask.first'), onClick: () => router.navigate('/ritmo', { replace: true }) }} />
    <//>`;
  }

  const done = Math.max(0, pr.stops);
  const total = done + pr.left;
  const last = pace ? pace.checkpoints[pace.checkpoints.length - 1] : null;
  const finished = pr.left === 0;
  return html`<${Screen} title=${t('ritmo.plus.title')} back="/ritmo">
    <section class="counter">
      <p class="counter__value" aria-live="polite" aria-label=${t('ritmo.plus.count', { done, total })}>
        <span>${done}</span><span class="counter__total"> / ${total}</span>
      </p>
      <p class="counter__projection">${projectionLine(pr)}</p>
      <div class="btn-row">
        <${Button} variant="secondary" icon="undo-2" label=${t('ritmo.plus.undo')} disabled=${!last?.plus}
          busy=${minus.busy} onClick=${minus.run} />
      </div>
      <button type="button" class="counter-btn" aria-label=${t('ritmo.plus.aria')} disabled=${finished || null}
        onClick=${plus.run}>
        <span class="counter-btn__plus" aria-hidden="true">+1</span>
        <span class="counter-btn__label" aria-hidden="true">${t(finished ? 'ritmo.plus.finished' : 'ritmo.plus.btn')}</span>
      </button>
    </section>
  <//>`;
}
