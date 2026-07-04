/**
 * Shared With Me - View files shared with the current user
 */

import { api } from '../api.js';
import { log } from '../log.js';
import { buildCloudPitchUrl } from '../content/loader/_shared.js';
import { safeHtml, raw, setSafeHtml } from '../ui/safe-dom.js';
import { t } from '../../i18n/index.js';

/**
 * Render "shared with me" view
 * @param {HTMLElement} container - Target container
 */
export const renderSharedWithMe = async (container) => {
    if (!container) return;

    setSafeHtml(container, safeHtml`
        <div class="shared-with-me loading">
            <div class="loading-spinner"></div>
            <p>${t('sharing.loading')}</p>
        </div>
    `);

    try {
        const data = await api('/content/shared-with-me');
        const shares = data.shares || [];

        if (shares.length === 0) {
            setSafeHtml(container, safeHtml`
                <div class="shared-with-me empty">
                    <p>${t('sharing.empty')}</p>
                </div>
            `);
            return;
        }

        const itemsHtml = shares.map(({ name, shared_by, content_type, content_ref_id } = {}) => {
            const downloadHtml = content_type === 'pitch'
                ? safeHtml`<a href="${buildCloudPitchUrl(content_ref_id)}" class="btn-primary-sm" data-testid="shared-download-pitch-btn" download>${t('sharing.downloadPitch')}</a>`
                : '';
            return safeHtml`
                <div class="shared-item">
                    <div class="shared-info">
                        <span class="shared-name">${name || t('sharing.fileFallback')}</span>
                        <span class="shared-by">${t('sharing.by', { name: shared_by })}</span>
                        <span class="shared-type">${content_type || t('sharing.fileFallback')}</span>
                    </div>
                    <div class="shared-actions">${raw(downloadHtml)}</div>
                </div>
            `;
        }).join('');
        setSafeHtml(container, safeHtml`
            <div class="shared-with-me">
                <h3>${t('sharing.title')}</h3>
                <div class="shared-list">${raw(itemsHtml)}</div>
            </div>
        `);
    } catch (error) {
        log.error('Failed to load shared files:', error);
        setSafeHtml(container, safeHtml`
            <div class="shared-with-me error">
                <p>${t('sharing.loadError', { msg: error.message })}</p>
            </div>
        `);
    }
};
