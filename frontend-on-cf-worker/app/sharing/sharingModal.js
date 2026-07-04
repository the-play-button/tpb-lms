/**
 * Sharing Modal - Share .pitch files with learners
 *
 * Opens a modal to share a content reference with an email address.
 * Uses the /api/content/:refId/share endpoint.
 */

import { api, apiPost, apiDelete } from '../api.js';
import { log } from '../log.js';
import { setSafeHtml , safeHtml} from '../ui/safe-dom.js';
import { t } from '../../i18n/index.js';

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
    setSafeHtml(modal, safeHtml`
        <div class="modal-content sharing-modal">
            <div class="modal-header">
                <h3>${t('sharing.shareTitle', { name: contentName })}</h3>
                <button class="modal-close" data-testid="sharing-modal-close" data-action="close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="share-form">
                    <label for="share-email">${t('sharing.recipientEmail')}</label>
                    <input type="email" id="share-email" data-testid="sharing-email-input" placeholder="nom@exemple.com" required />

                    <label for="share-role">${t('sharing.permission')}</label>
                    <select id="share-role" data-testid="sharing-role-select">
                        <option value="READ">${t('sharing.readOnly')}</option>
                        <option value="WRITE">${t('sharing.readWrite')}</option>
                    </select>

                    <button class="btn-primary" id="share-submit" data-testid="sharing-submit-btn">${t('sharing.share')}</button>
                </div>
                <div id="share-status" class="share-status"></div>

                <div class="share-existing">
                    <h4>${t('sharing.withAccess')}</h4>
                    <div id="permissions-list" class="permissions-list">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            </div>
        </div>
    `);

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
            statusEl.textContent = t('sharing.sharing');
            statusEl.className = 'share-status loading';

            await apiPost(`/content/${contentRefId}/share`, { email, role });

            statusEl.textContent = t('sharing.sharedWith', { email });
            statusEl.className = 'share-status success';
            document.getElementById('share-email').value = '';

            loadPermissions(contentRefId);
        } catch (error) {
            log.error('Share failed:', error);
            statusEl.textContent = t('course.genericError', { msg: error.message });
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
            setSafeHtml(container, safeHtml`<p class="no-permissions">${t('sharing.noActive')}</p>`);
            return;
        }

        setSafeHtml(container, permissions.map(({ id, shared_with, role } = {}) => safeHtml`
            <div class="permission-item" data-share-id="${id}">
                <div class="permission-info">
                    <span class="permission-email">${shared_with}</span>
                    <span class="permission-role">${role === 'WRITE' ? t('sharing.roleWrite') : t('sharing.roleRead')}</span>
                </div>
                <button class="btn-danger-sm" data-testid="sharing-revoke-btn" data-action="revoke" data-ref="${contentRefId}" data-share="${id}">
                    ${t('sharing.revoke')}
                </button>
            </div>
        `).join(''));

        // Event delegation : single listener on container handles every revoke.
        container.onclick = async (event) => {
            const btn = event.target.closest('[data-action="revoke"]');
            if (!btn || !container.contains(btn)) return;
            const refId = btn.dataset.ref;
            const shareId = btn.dataset.share;
            if (!confirm(t('sharing.revokeConfirm'))) return;
            try {
                await apiDelete(`/content/${refId}/share/${shareId}`);
                loadPermissions(refId);
            } catch (error) {
                log.error('Revoke failed:', error);
                alert(t('sharing.revokeError')); // explicit user feedback
            }
        };
    } catch (error) {
        setSafeHtml(container, safeHtml`<p class="error">${t('sharing.permissionsError')}</p>`);
    }
}
