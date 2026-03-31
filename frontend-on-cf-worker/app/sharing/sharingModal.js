// entropy-event-listeners-ok: modal uses imperative DOM event listeners (click-to-close, submit, revoke) because this is a vanilla JS module without a framework — listeners are scoped to the modal element and cleaned up on modal.remove()
// entropy-innerhtml-modal-or-error-ok: one-time modal render
/**
 * Sharing Modal - Share .pitch files with learners
 *
 * Opens a modal to share a content reference with an email address.
 * Uses the /api/content/:refId/share endpoint.
 */

import { api, apiPost, apiDelete } from '../api.js';
import { log } from '../log.js';

/**
 * Show sharing modal for a content reference
 * @param {string} contentRefId - Content reference ID
 * @param {string} contentName - Display name for the content
 */
export const showSharingModal = (contentRefId, contentName) => {
    const existing = document.getElementById('sharing-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'sharing-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content sharing-modal">
            <div class="modal-header">
                <h3>Partager "${contentName}"</h3>
                <button class="modal-close" data-testid="sharing-modal-close" data-action="close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="share-form">
                    <label for="share-email">Email du destinataire</label>
                    <input type="email" id="share-email" data-testid="sharing-email-input" placeholder="nom@exemple.com" required />

                    <label for="share-role">Permission</label>
                    <select id="share-role" data-testid="sharing-role-select">
                        <option value="READ">Lecture seule</option>
                        <option value="WRITE">Lecture et modification</option>
                    </select>

                    <button class="btn-primary" id="share-submit" data-testid="sharing-submit-btn">Partager</button>
                </div>
                <div id="share-status" class="share-status"></div>

                <div class="share-existing">
                    <h4>Personnes avec accès</h4>
                    <div id="permissions-list" class="permissions-list">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('[data-action="close"]').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    modal.querySelector('#share-submit').addEventListener('click', async () => {
        const email = document.getElementById('share-email').value.trim();
        const role = document.getElementById('share-role').value;
        const statusEl = document.getElementById('share-status');

        if (!email) {
            statusEl.textContent = 'Veuillez entrer une adresse email.';
            statusEl.className = 'share-status error';
            return;
        }

        try {
            statusEl.textContent = 'Partage en cours...';
            statusEl.className = 'share-status loading';

            await apiPost(`/content/${contentRefId}/share`, { email, role });

            statusEl.textContent = `Partagé avec ${email}`;
            statusEl.className = 'share-status success';
            document.getElementById('share-email').value = '';

            loadPermissions(contentRefId);
        } catch (error) {
            log.error('Share failed:', error);
            statusEl.textContent = `Erreur: ${error.message}`;
            statusEl.className = 'share-status error';
        }
    });

    loadPermissions(contentRefId);
};

/**
 * Load and render permissions list
 */
const loadPermissions = async (contentRefId) => {
    const container = document.getElementById('permissions-list');
    if (!container) return;

    try {
        const data = await api(`/content/${contentRefId}/permissions`);
        const permissions = data.permissions || [];

        if (permissions.length === 0) {
            container.innerHTML = '<p class="no-permissions">Aucun partage actif.</p>';
            return;
        }

        container.innerHTML = permissions.map(({ id, shared_with, role } = {}) => `
            <div class="permission-item" data-share-id="${id}">
                <div class="permission-info">
                    <span class="permission-email">${shared_with}</span>
                    <span class="permission-role">${role === 'WRITE' ? 'Modification' : 'Lecture'}</span>
                </div>
                <button class="btn-danger-sm" data-testid="sharing-revoke-btn" data-action="revoke" data-ref="${contentRefId}" data-share="${id}">
                    Révoquer
                </button>
            </div>
        `).join('');

        container.querySelectorAll('[data-action="revoke"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const refId = e.target.dataset.ref;
                const shareId = e.target.dataset.share;
                if (!confirm('Révoquer cet accès ?')) return;

                try {
                    await apiDelete(`/content/${refId}/share/${shareId}`);
                    loadPermissions(refId);
                } catch (error) {
                    log.error('Revoke failed:', error);
                }
            });
        });
    } catch (error) {
        container.innerHTML = '<p class="error">Erreur lors du chargement des permissions.</p>';
    }
}
