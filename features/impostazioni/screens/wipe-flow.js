// @ts-check
// "Elimina tutto" (SPEC 4.8): backup offer → second confirmation with the numbers → wipe.
// The wipe clears the database, the saved map tiles and the theme and language mirrors, then reloads.
import { html, useEffect, useState } from '../../../ui/html.js';
import { Dialog, toast } from '../../../ui/kit/index.js';
import { t, tn, db, backup, log, errors } from '../../../core/api.js';
import { megabytes } from '../logic/diagnostics.js';
import { loadCounts, saveBackupFile, toastSaved } from '../logic/actions.js';

/** @param {{onClose:()=>void}} props */
export default function WipeFlow({ onClose }) {
  const [step, setStep] = useState(/** @type {'ask'|'preparing'|'ready'|'confirm'|'wiping'} */ ('ask'));
  const [file, setFile] = useState(/** @type {File|null} */ (null));
  const [counts, setCounts] = useState({ notes: 0, shifts: 0, photos: 0, extra: [] });
  useEffect(() => {
    loadCounts().then(setCounts);
  }, []);

  const fail = (err) => {
    log.error('wipe', err);
    toast(t(errors.toUserKey(err)), { icon: 'triangle-alert' });
    setStep('ask');
  };
  const prepare = () => {
    setStep('preparing');
    // Van photos are always in this backup: after the wipe there is no other copy.
    backup.prepareBackup({ includeVan: true }).then((f) => {
      setFile(f);
      setStep('ready');
    }, fail);
  };
  const save = () => {
    if (!file) return;
    saveBackupFile(file).then((how) => {
      toastSaved(how);
      if (how === 'shared' || how === 'downloaded') setStep('confirm');
    }, fail);
  };
  const wipe = () => {
    setStep('wiping');
    db.wipeAll().catch(fail);
  };

  const skip = { label: t('impostazioni.wipe.skip'), variant: 'secondary', onClick: () => setStep('confirm') };
  const cancel = { label: t('core.action.cancel'), variant: 'ghost', onClick: onClose };

  if (step === 'ask') {
    return html`<${Dialog} open icon="download" tone="info" title=${t('impostazioni.wipe.askTitle')}
      text=${t('impostazioni.wipe.askText')}
      actions=${[{ label: t('impostazioni.wipe.prepare'), variant: 'primary', onClick: prepare }, skip, cancel]} />`;
  }
  if (step === 'preparing') {
    return html`<${Dialog} open icon="download" tone="info" title=${t('core.state.preparing')} actions=${[cancel]} />`;
  }
  if (step === 'ready' && file) {
    return html`<${Dialog} open icon="check" tone="success" title=${t('impostazioni.wipe.readyTitle')}
      text=${`${t('impostazioni.bk.ready', { n: megabytes(file.size) })} ${t('impostazioni.bk.notProtected')}`}
      actions=${[{ label: t('impostazioni.bk.save'), variant: 'primary', onClick: save }, skip, cancel]} />`;
  }
  const also = counts.extra.map((r) => {
    const label = tn(r.labelKey, r.count);
    return /\d/.test(label) ? label : `${r.count} ${label}`;
  }).join(', ');
  return html`<${Dialog} open icon="trash-2" tone="danger"
    title=${t('impostazioni.wipe.confirm', { notes: counts.notes, shifts: counts.shifts, photos: counts.photos })}
    text=${`${also ? `${t('impostazioni.wipe.also', { list: also })} ` : ''}${t('impostazioni.wipe.noReturn')}`}
    actions=${[
      { label: t('impostazioni.wipe.go'), variant: 'danger', onClick: step === 'wiping' ? () => {} : wipe },
      { label: t('impostazioni.wipe.keep'), variant: 'secondary', onClick: onClose },
    ]} />`;
}
