/**
 * Handle click on KMS link
 */

import { parseKmsUrl } from './parseKmsUrl.js';
import { fetchKmsPage } from './fetchKmsPage.js';
import { renderKmsModal } from './renderKmsModal.js';

/**
 * Handle click on KMS link
 * @param {Event} event - Click event
 */
export const handleKmsLinkClick = async event => {
    const link = event.target.closest('a[href^="/kms/"]');
    if (!link) return;

    event.preventDefault();

    const parsed = parseKmsUrl(link.getAttribute('href'));
    if (!parsed) {
        console.error('Invalid KMS URL:', link.href);
        return;
    }

    try {
        link.classList.add('kms-loading');

        const page = await fetchKmsPage(parsed.pageId);
        renderKmsModal(page);

    } catch (error) {
        console.error('Failed to load KMS page:', error);
        if (window.showNotification) {
            window.showNotification('Impossible de charger la ressource', 'error');
        } else {
            alert('Impossible de charger la ressource');
        }
    } finally {
        link.classList.remove('kms-loading');
    }
};
