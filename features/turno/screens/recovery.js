// @ts-check
import { html, useEffect, useState } from '../../../ui/html.js';
import { useLang, useAction } from '../../../ui/hooks.js';
import { Dialog, Keypad, keypadTime } from '../../../ui/kit/index.js';
import { t, session, events, router, clock } from '../../../core/api.js';
import { endFromTime, timeDigits } from '../logic/shift-math.js';
import * as state from '../state.js';

/**
 * Forgotten stop (SPEC 4.2): the shift was not seen for 3 h or more. Overlay slot, so it shows on
 * any screen. Saving closes the shift at the chosen time and marks it edited.
 */
export default function Recovery() {
  useLang();
  /** The shift as it was when found stale: its lastSeenAt is the preset and the reference day. */
  const [stale, setStale] = useState(/** @type {import('../../../core/types.js').Shift|null} */ (null));
  const [digits, setDigits] = useState('');
  const [fresh, setFresh] = useState(true);
  const [bad, setBad] = useState(false);

  useEffect(() => {
    const show = (shift) => {
      if (!shift || state.recoveryDismissed(shift.id)) return;
      setStale(shift);
      setDigits(timeDigits(shift.lastSeenAt));
      setFresh(true);
      setBad(false);
    };
    if (session.isStale()) show(session.active());
    const offs = [
      events.on('shift:resumed', (e) => {
        if (e.stale) show(e.shift);
      }),
      events.on('shift:ended', () => setStale(null)),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const save = useAction(async () => {
    const hhmm = keypadTime(digits);
    const endAt = hhmm && stale ? endFromTime(hhmm, stale, clock.now()) : null;
    if (endAt === null) {
      setBad(true);
      return;
    }
    await session.endShift({ endAt });
    setStale(null);
    router.navigate('/');
  });
  const still = () => {
    if (stale) state.dismissRecovery(stale.id);
    setStale(null);
  };
  // The first key replaces the preset time.
  const type = (v) => {
    setDigits(fresh && v.length > digits.length ? v.slice(-1) : v);
    setFresh(false);
    setBad(false);
  };

  if (!stale) return null;
  return html`<${Dialog} open icon="clock" title=${t('turno.recovery.title')} actions=${[
    { label: t('core.action.save'), variant: 'primary', onClick: save.run },
    { label: t('turno.recovery.still'), variant: 'secondary', onClick: still },
  ]}>
    <${Keypad} mode="time" value=${digits} label=${t('turno.recovery.label')} onChange=${type} />
    ${bad && html`<p class="field__error" role="alert">${t('turno.recovery.bad')}</p>`}
  <//>`;
}
