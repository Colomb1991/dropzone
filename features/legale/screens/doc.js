// @ts-check
// The four legal pages. Privacy, terms and licences are the files of ../content/ (byte copies of
// docs/legal), read from our own origin; "Avvertenze" is built from the dictionaries.
import { html, useEffect, useState } from '../../../ui/html.js';
import { Screen, Banner, Chips, Chip, Empty } from '../../../ui/kit/index.js';
import { useLang } from '../../../ui/hooks.js';
import { t, config, env, format, gateway, router, log, OPERATOR } from '../../../core/api.js';
import { parseBlocks, parseInline, inlineText, fill } from '../logic/markdown.js';
import {
  DOC_IDS, CONTENT_DIR, docId, docFile, parseDocDate, operatorMissing, legalVars,
} from '../logic/docs.js';

/** @param {import('../logic/markdown.js').Inline[]} parts */
function inline(parts) {
  return parts.map((p) => {
    if (p.t === 'bold') return html`<strong>${inline(p.inl)}</strong>`;
    if (p.t === 'code') return html`<code>${p.v}</code>`;
    if (p.t === 'link') {
      return p.external
        ? html`<a href=${p.href} target="_blank" rel="noopener noreferrer">${p.v}</a>`
        : html`<a href=${p.href}>${p.v}</a>`;
    }
    return p.v;
  });
}

/** @param {import('../logic/markdown.js').Block} b */
function block(b) {
  if (b.t === 'h2') return html`<h2>${inline(b.inl)}</h2>`;
  if (b.t === 'p') return html`<p>${inline(b.inl)}</p>`;
  if (b.t === 'ul') return html`<ul>${b.items.map((item) => html`<li>${inline(item)}</li>`)}</ul>`;
  if (b.t === 'quote') return html`<blockquote class="f-legale-box">${b.blocks.map(block)}</blockquote>`;
  // The page title is the screen header.
  return null;
}

function vars() {
  return legalVars({
    appName: t('core.app.name'), appUrl: env.appUrl(), operator: OPERATOR,
    dateText: format.dateLong(parseDocDate(config.DOCS_DATE)), missingText: t('legale.missingValue'),
  });
}

function Disclaimers() {
  const lines = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => t(`legale.avv.${n}`));
  return html`<div class="f-legale-doc">
    <p class="t-muted">${format.dateLong(parseDocDate(config.DOCS_DATE))}</p>
    <ul>${lines.map((line) => html`<li>${inline(parseInline(line))}</li>`)}</ul>
  </div>`;
}

/** @param {{params?:{doc?:string}}} props */
export default function LegalDoc({ params }) {
  const lang = useLang();
  const id = docId(params?.doc ?? '');
  const file = docFile(id, lang);
  const [state, setState] = useState({ file: '', text: '', error: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!file) return undefined;
    let alive = true;
    gateway.local(`${CONTENT_DIR}${file}`, { as: 'text', timeoutMs: 8000 }).then(
      (text) => alive && setState({ file, text: String(text), error: false }),
      (err) => {
        log.warn('legale', 'load-failed', { code: String(err?.code ?? '') });
        if (alive) setState({ file, text: '', error: true });
      },
    );
    return () => {
      alive = false;
    };
  }, [file, attempt]);

  const loaded = file !== null && state.file === file && !state.error;
  const blocks = loaded ? parseBlocks(fill(state.text, vars())) : [];
  const h1 = blocks.find((b) => b.t === 'h1');
  const title = h1 && h1.t === 'h1' ? inlineText(h1.inl) : t(`legale.doc.${id}`);

  return html`<${Screen} title=${title} back="/altro" banner=${false}>
    ${operatorMissing(OPERATOR) && html`<${Banner} tone="danger" icon="triangle-alert"
      text=${t('legale.operatorMissing')} />`}
    <${Chips} label=${t('legale.tabs')}>
      ${DOC_IDS.map((d) => html`<${Chip} key=${d} label=${t(`legale.tab.${d}`)} pressed=${d === id}
        onToggle=${() => router.navigate(`/legale/${d}`, { replace: true })} />`)}
    <//>
    ${file === null && html`<${Disclaimers} />`}
    ${loaded && html`<div class="f-legale-doc">${blocks.map(block)}</div>`}
    ${file !== null && state.file === file && state.error && html`<${Empty} icon="wifi-off"
      title=${t('legale.loadError')} text=${t('legale.loadErrorText')}
      action=${{ label: t('core.action.retry'), onClick: () => setAttempt((n) => n + 1) }} />`}
    ${file !== null && state.file !== file && html`<p class="t-muted" role="status">${t('core.state.loading')}</p>`}
  <//>`;
}
