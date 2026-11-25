// @ts-check
// Backup (SPEC 4.8): "Prepara backup" builds the file, "Salva il file" only shares it (prepare,
// then tap). Restore is merge-only: nothing on the phone is deleted.
import { html, useState } from '../../../ui/html.js';
import {
  Screen, Button, Art, Toggle, Sheet, List, ListRow, Banner, toast,
} from '../../../ui/kit/index.js';
import { useSetting, useLive, useAction, useTick } from '../../../ui/hooks.js';
import { t, format, backup, camera, log, errors } from '../../../core/api.js';
import { megabytes } from '../logic/diagnostics.js';
import { previewRows } from '../logic/options.js';
import { safe, vanUsage, saveBackupFile, toastSaved, afterRestore } from '../logic/actions.js';

const REASON_KEYS = { 'not-backup': 'core.err.backupNot', 'too-new': 'core.err.backupNew', 'too-big': 'core.err.backupBig' };

/** @param {{preview:any, busy:boolean, onImport:()=>void, onClose:()=>void}} props */
function PreviewSheet({ preview, busy, onImport, onClose }) {
  const rows = previewRows(preview.counts);
  return html`<${Sheet} open title=${t('impostazioni.bk.previewTitle', { date: format.dateLong(preview.createdAt) })}
    onClose=${onClose}
    footer=${html`
      <p class="t-caption t-muted">${t('impostazioni.bk.importOnly')}</p>
      <${Button} block size="xl" icon="upload" label=${t('impostazioni.bk.doImport')} busy=${busy} onClick=${onImport} />`}>
    <p class="t-body-m t-muted">${t('impostazioni.bk.previewTime',
      { time: format.time(preview.createdAt), v: preview.appVersion })}</p>
    <${List}>
      ${rows.map(([store, n]) => html`<${ListRow} key=${store} title=${t(`impostazioni.bk.count.${store}`)}
        value=${format.number(n)} />`)}
      <${ListRow} title=${t(preview.vanMedia ? 'impostazioni.bk.withVan' : 'impostazioni.bk.withoutVan')} />
    <//>
    <p class="t-body-m">${t('impostazioni.bk.mergeNote')}</p>
  <//>`;
}

export default function BackupScreen() {
  const [lastBackupAt] = useSetting('lastBackupAt');
  const now = useTick(60000);
  const [includeVan, setIncludeVan] = useState(false);
  const [file, setFile] = useState(/** @type {File|null} */ (null));
  const [preview, setPreview] = useState(/** @type {any} */ (null));
  const [problem, setProblem] = useState('');
  const van = useLive(['van'], () => safe(vanUsage(), 0));

  const prepare = useAction(async () => {
    setFile(null);
    setFile(await backup.prepareBackup({ includeVan }));
  });
  const toggleVan = (v) => {
    setIncludeVan(v);
    setFile(null);
  };
  const save = () => {
    if (!file) return;
    // First statement of the tap: the share sheet (or the download) needs the user activation.
    saveBackupFile(file).then(toastSaved, (err) => {
      log.error('backup', err);
      toast(t(errors.toUserKey(err)), { icon: 'triangle-alert' });
    });
  };
  const pick = () => {
    // The file picker opens inside the tap.
    camera.pickFile().then(async (picked) => {
      if (!picked) return;
      const res = await backup.previewBackup(picked);
      if (!res.ok) {
        setProblem(t(REASON_KEYS[res.reason] ?? 'core.err.backupNot'));
        return;
      }
      setProblem('');
      setPreview({ file: picked, ...res.preview });
    }).catch((err) => {
      log.error('backup', err);
      setProblem(t('core.err.backupNot'));
    });
  };
  const restore = useAction(async () => {
    const stats = await backup.restoreBackup(preview.file);
    await afterRestore();
    setPreview(null);
    toast(t('impostazioni.bk.done', { added: stats.added, updated: stats.updated }), { icon: 'check' });
  });

  return html`<${Screen} title=${t('impostazioni.backup')} back="/impostazioni"
    sticky=${file
      ? html`<${Button} block size="xl" icon="share-2" label=${t('impostazioni.bk.save')} onClick=${save} />`
      : html`<${Button} block size="xl" icon="download" busy=${prepare.busy}
          label=${prepare.busy ? t('core.state.preparing') : t('impostazioni.bk.prepare')}
          onClick=${() => prepare.run()} />`}>
    <div class="f-imp">
      <div class="f-imp-art"><${Art} name="guard" alt=${t('impostazioni.bk.art')} /></div>
      <p class="t-title-m">${lastBackupAt === null ? t('impostazioni.bk.never')
        : t('impostazioni.bk.last', { when: format.ago(lastBackupAt, now) })}</p>
      <div class="f-imp-card">
        <${Toggle} label=${t('impostazioni.bk.van', { n: format.number(megabytes(van.data ?? 0), 1) })}
          checked=${includeVan} onChange=${toggleVan} />
        ${file && html`<p class="f-imp-ready" role="status">
          ${t('impostazioni.bk.ready', { n: format.number(megabytes(file.size), 1) })}</p>`}
        <p class="t-body-m t-muted">${t('impostazioni.bk.notProtected')} ${t('impostazioni.bk.sendYourself')}</p>
      </div>
      <div class="f-imp-card">
        <${Button} block variant="secondary" icon="upload" label=${t('impostazioni.bk.import')} onClick=${pick} />
        <p class="t-body-m t-muted">${t('impostazioni.bk.importOnly')}</p>
        ${problem && html`<${Banner} tone="danger" icon="triangle-alert" text=${problem} />`}
      </div>
    </div>
    ${preview && html`<${PreviewSheet} preview=${preview} busy=${restore.busy} onImport=${() => restore.run()}
      onClose=${() => setPreview(null)} />`}
  <//>`;
}
