// entropy-prohibited-timer-ok: timer in renderKmsModal is intentional for UX timing
/**
 * Render a KMS page in a modal
 */

const MODAL_EXIT_ANIMATION_MS = 200; // CSS modal fade-out animation duration

/**
 * Render a KMS page in a modal
 * @param {Object} page - Page data from API
 */
export const renderKmsModal = page => {
    const existingModal = document.getElementById('kms-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'kms-modal';
    modal.className = 'kms-modal';
    // entropy-innerhtml-ok: one-time modal render
    modal.innerHTML = `
        <div class="kms-modal-backdrop" data-testid="kms-modal-backdrop" onclick="window.closeKmsModal()"></div>
        <div class="kms-modal-content">
            <div class="kms-modal-header">
                <div class="kms-breadcrumb">
                    <span class="kms-space">${page.space_name || 'Reference'}</span>
                    <span class="kms-separator">\u203A</span>
                    <span class="kms-title">${page.title}</span>
                </div>
                <button class="kms-close-btn" data-testid="kms-modal-close" onclick="window.closeKmsModal()" title="Fermer">\u2715</button>
            </div>
            <div class="kms-modal-body markdown-body">
                ${marked.parse(page.content_md || '*Aucun contenu disponible*')}
            </div>
            <div class="kms-modal-footer">
                <span class="kms-meta">Type: ${page.type || 'MARKDOWN'}</span>
                ${page.updated_at ? `<span class="kms-meta">Mis \u00E0 jour: ${new Date(page.updated_at).toLocaleDateString('fr-FR')}</span>` : ''}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    requestAnimationFrame(() => {
        modal.classList.add('kms-modal-visible');
    });

    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            window.closeKmsModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
};

/**
 * Close the KMS modal
 */
window.closeKmsModal = function() { // entropy-global-pollution-ok: global in renderKmsModal exposed for HTML inline onclick binding // entropy-orphan-global-ok: inline global function
    const modal = document.getElementById('kms-modal');
    if (modal) {
        modal.classList.remove('kms-modal-visible');
        // entropy-prohibited-timer-ok: delay for CSS exit animation
        setTimeout(() => modal.remove(), MODAL_EXIT_ANIMATION_MS);
    }
};
