/**
 * KMS Viewer - Display reference documents from KMS
 * 
 * This module handles displaying KMS pages (references, rules, etc.)
 * when users click on resource links in course content.
 * 
 * Usage:
 * - Links in course content: /kms/:spaceId/:pageId
 * - Example: /kms/pa06-references/ref-som-template
 */

import { api } from '../api.js';

/**
 * Parse KMS URL and extract space/page IDs
 * @param {string} url - URL like /kms/pa06-references/ref-som-template
 * @returns {{spaceId: string, pageId: string} | null}
 */
export function parseKmsUrl(url) {
    const match = url.match(/^\/kms\/([^/]+)\/([^/]+)$/);
    if (match) {
        return { spaceId: match[1], pageId: match[2] };
    }
    
    // Also try just /kms/:pageId
    const simpleMatch = url.match(/^\/kms\/([^/]+)$/);
    if (simpleMatch) {
        return { spaceId: null, pageId: simpleMatch[1] };
    }
    
    return null;
}

/**
 * Fetch a KMS page from the API
 * @param {string} pageId - Page ID to fetch
 * @returns {Promise<Object>} Page data
 */
export async function fetchKmsPage(pageId) {
    const result = await api(`/kms/pages/${pageId}`);
    return result.page;
}

/**
 * Fetch all pages in a KMS space
 * @param {string} spaceId - Space ID
 * @returns {Promise<Object>} Space data with pages
 */
export async function fetchKmsSpace(spaceId) {
    const result = await api(`/kms/spaces/${spaceId}`);
    return result.space;
}

/**
 * Render a KMS page in a modal
 * @param {Object} page - Page data from API
 */
export function renderKmsModal(page) {
    // Remove existing modal if any
    const existingModal = document.getElementById('kms-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'kms-modal';
    modal.className = 'kms-modal';
    modal.innerHTML = `
        <div class="kms-modal-backdrop" onclick="window.closeKmsModal()"></div>
        <div class="kms-modal-content">
            <div class="kms-modal-header">
                <div class="kms-breadcrumb">
                    <span class="kms-space">${page.space_name || 'Reference'}</span>
                    <span class="kms-separator">›</span>
                    <span class="kms-title">${page.title}</span>
                </div>
                <button class="kms-close-btn" onclick="window.closeKmsModal()" title="Fermer">✕</button>
            </div>
            <div class="kms-modal-body markdown-body">
                ${marked.parse(page.content_md || '*Aucun contenu disponible*')}
            </div>
            <div class="kms-modal-footer">
                <span class="kms-meta">Type: ${page.type || 'MARKDOWN'}</span>
                ${page.updated_at ? `<span class="kms-meta">Mis à jour: ${new Date(page.updated_at).toLocaleDateString('fr-FR')}</span>` : ''}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add animation class after a tick
    requestAnimationFrame(() => {
        modal.classList.add('kms-modal-visible');
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            window.closeKmsModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

/**
 * Close the KMS modal
 */
window.closeKmsModal = function() {
    const modal = document.getElementById('kms-modal');
    if (modal) {
        modal.classList.remove('kms-modal-visible');
        setTimeout(() => modal.remove(), 200);
    }
};

/**
 * Handle click on KMS link
 * @param {Event} event - Click event
 */
export async function handleKmsLinkClick(event) {
    const link = event.target.closest('a[href^="/kms/"]');
    if (!link) return;
    
    event.preventDefault();
    
    const parsed = parseKmsUrl(link.getAttribute('href'));
    if (!parsed) {
        console.error('Invalid KMS URL:', link.href);
        return;
    }
    
    try {
        // Show loading state
        link.classList.add('kms-loading');
        
        const page = await fetchKmsPage(parsed.pageId);
        renderKmsModal(page);
        
    } catch (error) {
        console.error('Failed to load KMS page:', error);
        // Show error notification
        if (window.showNotification) {
            window.showNotification('Impossible de charger la ressource', 'error');
        } else {
            alert('Impossible de charger la ressource');
        }
    } finally {
        link.classList.remove('kms-loading');
    }
}

/**
 * Initialize KMS link handling
 * Call this after rendering course content
 */
export function initKmsLinks() {
    // Use event delegation on the document
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href^="/kms/"]');
        if (link) {
            handleKmsLinkClick(event);
        }
    });
}
