// @ts-check
// All via Intl in the device time zone.
import { t, tn, locale } from './i18n.js';

const fmt = (opts) => new Intl.DateTimeFormat(locale(), opts);

/** "17:40" */
export function time(ts) {
  return fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(ts);
}

/** "3 ott" / "3 Oct" */
export function dateShort(ts) {
  return fmt({ day: 'numeric', month: 'short' }).format(ts);
}

/** "25 novembre 2026" */
export function dateLong(ts) {
  return fmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(ts);
}

/** "Novembre 2026"; month is 1–12. */
export function monthTitle(year, month) {
  const s = fmt({ month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Locale number with at most `maxDecimals` decimals ("1,5"). */
export function number(n, maxDecimals = 0) {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: maxDecimals }).format(n);
}

/** "7 h 45", "25 min" */
export function duration(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return t('core.fmt.min', { n: min });
  return t('core.fmt.hm', { h: Math.floor(min / 60), m: String(min % 60).padStart(2, '0') });
}

/** "80 m" (rounded to 10) / "1,2 km" */
export function distance(m) {
  if (m < 995) return t('core.fmt.m', { n: Math.max(10, Math.round(m / 10) * 10) });
  return t('core.fmt.km', { n: number(m / 1000, 1) });
}

/** "12 min fa" */
export function ago(ts, now) {
  const min = Math.floor((now - ts) / 60000);
  if (min < 1) return t('core.fmt.now');
  if (min < 60) return t('core.fmt.agoMin', { n: min });
  if (min < 1440) return t('core.fmt.agoH', { n: Math.floor(min / 60) });
  return tn('core.fmt.agoD', Math.floor(min / 1440));
}

/** "±8 m" */
export function accuracy(m) {
  return t('core.fmt.acc', { n: Math.round(m) });
}

/** Local "YYYY-MM-DD", from local getters. */
export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Weekday name; day is 1 = Monday … 7 = Sunday. */
export function weekday(day, style = 'long') {
  return t(`core.day.${style === 'short' ? 'short' : 'long'}.${day}`);
}

function hhmm(s) {
  const [h, m] = s.split(':');
  return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`;
}

/** "Mar e ven, 7–14" · "Tutti i giorni, 7:30–10:30" · "" for no schedule. */
export function scheduleLabel(s) {
  if (!s) return '';
  let days;
  if (s.days.length === 7) days = t('core.fmt.everyDay');
  else {
    const names = s.days.map((d) => weekday(d, 'short'));
    const last = names.pop();
    days = names.length ? `${names.join(', ')} ${t('core.fmt.and')} ${last}` : String(last);
    days = days.charAt(0).toUpperCase() + days.slice(1);
  }
  const wins = (s.windows ?? []).map((w) => `${hhmm(w.from)}–${hhmm(w.to)}`).join(', ');
  return wins ? `${days}, ${wins}` : days;
}

/** "+39 333 1234567" from E.164. */
export function phone(e164) {
  const m = /^\+(39|44|33|49|34|41|1)(\d{3})(\d+)$/.exec(String(e164 ?? ''));
  return m ? `+${m[1]} ${m[2]} ${m[3]}` : String(e164 ?? '');
}

/** "45.46420, 9.19000" */
export function coords(lat, lon) {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
