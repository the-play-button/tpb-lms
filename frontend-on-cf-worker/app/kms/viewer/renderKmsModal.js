/**
 * Render a KMS page in a modal
 */

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
    // entropy-innerhtml-ok: one-time modal render
    modal.innerHTML = `
        <div class="kms-modal-backdrop" onclick="window.closeKmsModal()"></div>
        <div class="kms-modal-content">
            <div class="kms-modal-header">
                <div class="kms-breadcrumb">
                    <span class="kms-space">${page.space_name || 'Reference'}</span>
                    <span class="kms-separator">\u203A</span>
                    <span class="kms-title">${page.title}</span>
                </div>
                <button class="kms-close-btn" onclick="window.closeKmsModal()" title="Fermer">\u2715</button>
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
window.closeKmsModal = function() { // entropy-global-pollution-ok: intentional global for HTML onclick // entropy-orphan-global-ok: inline global function
    const modal = document.getElementById('kms-modal');
    if (modal) {
        modal.classList.remove('kms-modal-visible');
        // entropy-prohibited-timer-ok: delay for CSS exit animation
        setTimeout(() => modal.remove(), 200);
    }
};
