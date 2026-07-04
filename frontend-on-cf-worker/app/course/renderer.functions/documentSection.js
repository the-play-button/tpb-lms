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

export const renderVideoContent = (ctx, videoHtml) => {
    const documentHtml = renderDocumentSection(ctx.cls);

    if (videoHtml && documentHtml) {
        return videoHtml + '<hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--border);">' + documentHtml;
    }

    return videoHtml || documentHtml || safeHtml`<p>${t('course.noContent')}</p>`;
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
        console.error('Failed to load document content', { error });
        container.classList.remove('loading');
        container.classList.add('error');
        setSafeHtml(container, safeHtml`
            <div class="error-message">
                <p>Erreur lors du chargement du contenu.</p>
                <button data-testid="content-reload-btn" onclick="window.location.reload()">Réessayer</button>
            </div>
        `);
    }
};
