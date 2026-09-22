/**
 * Document section renderer — markdown fetched from cloud ref (BYOC) or
 * direct URL, rendered with marked.parse + stripFrontmatter cleanup.
 */
import { fetchMarkdown, isCloudRef, fetchCloudContent } from '../../content/loader/index.js';
import { stripFrontmatter, cleanMarkdownForLms } from '../../content/loader/_shared.js';
import { getDocumentMedia } from './_mediaHelpers.js';
import { setSafeHtml, safeHtml, raw } from '../../ui/safe-dom.js';
import { t } from '../../../i18n/index.js';

export const renderDocumentSection = cls => {
    const documentMedia = getDocumentMedia(cls);
    if (!documentMedia) {
        return cls.description
            ? safeHtml`<p class="step-description">${cls.description}</p>`
            : '';
    }

    return safeHtml`
        <div id="document-content-${cls.id}" class="document-content loading">
            <div class="loading-spinner"></div>
            <p>${t('course.loading')}</p>
        </div>
    `;
};

// Inline step body stored in raw_json.tpb_content_md (self-contained, no
// DOCUMENT-media fetch). Rendered with the same marked.parse pipeline as the
// KMS modal + the DOCUMENT path. The cloudflarestream sentinel is NOT
// markdown (it's a video embed handled elsewhere) so it is excluded here.
const renderInlineContentMd = cls => {
    const md = cls.content_md;
    if (!md || md.includes('cloudflarestream.com')) return '';
    return `<div class="markdown-body">${marked.parse(cleanMarkdownForLms(md))}</div>`;
};

// Whisper transcript stored in raw_json.tpb_transcript_md (recovered by the
// skool-scraping `transcribe` phase). A transcript is a large wall of text, so it is
// ALWAYS rendered collapsed — the learner opens it on demand (never expanded by default,
// with OR without a video).
const renderTranscript = (ctx) => {
    const md = ctx.cls.transcript_md;
    if (!md) return '';
    const body = `<div class="markdown-body transcript-body">${marked.parse(md)}</div>`;
    // Collapsed panel. Primary action = COPY (paste into an LLM/notes) ; the row toggles to read.
    // The copy click is owned by ONE delegated listener on #somViewer (setupEventListeners) which
    // reads the transcript from state — no per-render wiring, no transcript text baked into the DOM.
    return `<details class="transcript-panel">`
        + `<summary class="transcript-summary" data-testid="transcript-toggle">`
        + `<span class="transcript-label">${t('course.transcript')}</span>`
        + `<button type="button" class="transcript-copy" data-testid="transcript-copy" title="${t('course.copyTranscript')}">${t('course.copyTranscript')}</button>`
        + `</summary>${body}</details>`;
};

// Mined toolkit resources stored in raw_json.tpb_resources_json — an array of {title, content}
// (e.g. the master Google Doc, each harvested custom-GPT prompt system). Rendered as ONE collapsed
// copy-first panel per item — like the transcript, NOT dumped inline as course content. Each panel's
// "Copier" is owned by the SAME single delegated listener on #somViewer (reads from state by index),
// so no per-render wiring and no huge text kept live in the DOM until opened.
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const renderResources = (ctx) => {
    const items = ctx.cls.resources_json;
    if (!Array.isArray(items) || items.length === 0) return '';
    return items.map((r, i) =>
        `<details class="transcript-panel resource-panel">`
        + `<summary class="transcript-summary" data-testid="resource-toggle">`
        + `<span class="transcript-label">🧰 ${escapeHtml(r.title || t('course.resources'))}</span>`
        + `<button type="button" class="transcript-copy resource-copy" data-resource-index="${i}" data-testid="resource-copy" title="${t('course.copyResource')}">${t('course.copyResource')}</button>`
        + `</summary><div class="markdown-body transcript-body">${marked.parse(r.content || '')}</div></details>`
    ).join('');
};

export const renderVideoContent = (ctx, videoHtml) => {
    const documentHtml = renderDocumentSection(ctx.cls);
    const inlineMd = renderInlineContentMd(ctx.cls);
    const transcriptHtml = renderTranscript(ctx);
    const resourcesHtml = renderResources(ctx);

    const parts = [videoHtml, inlineMd, documentHtml, transcriptHtml, resourcesHtml].filter(Boolean);
    if (parts.length === 0) return safeHtml`<p>${t('course.noContent')}</p>`;

    const sep = '<hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--border);">';
    return parts.join(sep);
};

export const loadDocumentContent = async cls => {
    const documentMedia = getDocumentMedia(cls);
    if (!documentMedia) return;

    const container = document.getElementById(`document-content-${cls.id}`);
    if (!container) return;

    try {
        let markdown;

        if (isCloudRef(documentMedia)) {
            const rawMd = await fetchCloudContent(documentMedia.content_ref_id);
            markdown = stripFrontmatter(rawMd);
            markdown = cleanMarkdownForLms(markdown);
        } else {
            markdown = await fetchMarkdown(documentMedia.url);
        }

        const html = marked.parse(markdown);

        container.classList.remove('loading');
        setSafeHtml(container, safeHtml`<div class="markdown-body">${raw(html)}</div>`);
    } catch (error) {
        const url = isCloudRef(documentMedia) ? documentMedia.content_ref_id : documentMedia.url;
        console.error('Failed to load document content', { url, message: error?.message ?? String(error) });
        container.classList.remove('loading');
        container.classList.add('error');
        setSafeHtml(container, safeHtml`
            <div class="error-message">
                <p>${t('course.contentLoadError')}</p>
                <button data-testid="content-reload-btn" onclick="window.location.reload()">${t('course.retry')}</button>
            </div>
        `);
    }
};
