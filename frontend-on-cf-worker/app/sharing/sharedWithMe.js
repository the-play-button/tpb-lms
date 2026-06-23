/**
 * Shared With Me - View files shared with the current user
 */

import { api } from '../api.js';
import { log } from '../log.js';
import { buildCloudPitchUrl } from '../content/loader/_shared.js';
import { safeHtml, raw, setSafeHtml } from '../ui/safe-dom.js';

/**
 * Render "shared with me" view
 * @param {HTMLElement} container - Target container
 */
export const renderSharedWithMe = async (container) => {
    if (!container) return;

    setSafeHtml(container, safeHtml`
        <div class="shared-with-me loading">
            <div class="loading-spinner"></div>
            <p>Chargement des fichiers partagés...</p>
        </div>
    `);

    try {
        const data = await api('/content/shared-with-me');
        const shares = data.shares || [];

        if (shares.length === 0) {
            setSafeHtml(container, safeHtml`
                <div class="shared-with-me empty">
                    <p>Aucun fichier partagé avec vous.</p>
                </div>
            `);
            return;
        }

        const itemsHtml = shares.map(({ name, shared_by, content_type, content_ref_id } = {}) => {
            const downloadHtml = content_type === 'pitch'
                ? safeHtml`<a href="${buildCloudPitchUrl(content_ref_id)}" class="btn-primary-sm" data-testid="shared-download-pitch-btn" download>Télécharger .pitch</a>`
                : '';
            return safeHtml`
                <div class="shared-item">
                    <div class="shared-info">
                        <span class="shared-name">${name || 'Fichier'}</span>
                        <span class="shared-by">par ${shared_by}</span>
                        <span class="shared-type">${content_type || 'fichier'}</span>
                    </div>
                    <div class="shared-actions">${raw(downloadHtml)}</div>
                </div>
            `;
        }).join('');
        setSafeHtml(container, safeHtml`
            <div class="shared-with-me">
                <h3>Fichiers partagés avec moi</h3>
                <div class="shared-list">${raw(itemsHtml)}</div>
            </div>
        `);
    } catch (error) {
        log.error('Failed to load shared files:', error);
        setSafeHtml(container, safeHtml`
            <div class="shared-with-me error">
                <p>Erreur lors du chargement: ${error.message}</p>
            </div>
        `);
    }
};
