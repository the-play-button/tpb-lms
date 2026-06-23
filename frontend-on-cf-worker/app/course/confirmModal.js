
/**
 * Confirmation Modal
 * 
 * Shows confirmation dialog before progressing on CONTENT steps.
 * Enforces hyper-linear progression with no going back.
 */

/**
 * Show confirmation modal
 * @param {Object} options - Modal options
 * @param {string} options.title - Modal title
 * @param {string} options.message - Modal message
 * @param {string} options.confirmText - Confirm button text
 * @param {string} options.cancelText - Cancel button text
 * @param {Function} options.onConfirm - Callback on confirm
 * @param {Function} options.onCancel - Callback on cancel
 */
export const showConfirmModal = options => {
    const {
        title = 'Confirmer',
        message = 'Êtes-vous sûr de vouloir continuer ?',
        confirmText = 'Confirmer',
        cancelText = 'Annuler',
        onConfirm = () => {},
        onCancel = () => {},
        type = 'warning' // 'warning', 'info', 'danger'
    } = options;
    
    closeConfirmModal();
    
    const iconMap = {
        warning: '⚠️',
        info: 'ℹ️',
        danger: '🚫'
    };
    
    const modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = `confirm-modal ${type}`;
    modal.innerHTML = `
        <div class="modal-overlay" data-action="cancel"></div>
        <div class="modal-content">
            <div class="modal-header">
                <span class="modal-icon">${iconMap[type] || iconMap.warning}</span>
                <h3 class="modal-title">${title}</h3>
            </div>
            <div class="modal-body">
                <p>${message}</p>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-cancel" data-testid="confirm-modal-cancel" data-action="cancel">${cancelText}</button>
                <button class="btn-primary modal-confirm" data-testid="confirm-modal-confirm" data-action="confirm">${confirmText}</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.body.style.overflow = 'hidden';
    
    // Signal-based focus : requestAnimationFrame runs after the browser
    // layouts the newly-appended modal, so .focus() targets a painted node.
    requestAnimationFrame(() => {
        modal.querySelector('.modal-confirm')?.focus();
    });
    
    modal.addEventListener('click', (e) => {
        const action = e.target.dataset?.action;
        if (action === 'confirm') {
            closeConfirmModal();
            onConfirm();
        } else if (action === 'cancel') {
            closeConfirmModal();
            onCancel();
        }
    });
    
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeConfirmModal();
            onCancel();
        }
    };
    document.addEventListener('keydown', escHandler);
    modal._escHandler = escHandler;
    
    return modal;
};

/**
 * Close the confirmation modal
 */
export const closeConfirmModal = () => {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        if (modal._escHandler) {
            document.removeEventListener('keydown', modal._escHandler);
        }
        modal.remove();
        document.body.style.overflow = '';
    }
}

/**
 * Show content step confirmation
 * Specific confirmation for progressing past a CONTENT step
 * @param {Object} options - Options
 * @param {string} options.stepName - Current step name
 * @param {Function} options.onConfirm - Callback on confirm
 * @param {Function} options.onCancel - Callback on cancel
 */
export const showContentStepConfirmation = options => {
    const { stepName = 'cette étape', onConfirm, onCancel } = options;
    
    return showConfirmModal({
        title: 'Passer à l\'étape suivante ?',
        message: `
            <strong>Attention :</strong> Une fois que vous passez à l'étape suivante, 
            vous ne pourrez plus revenir à "${stepName}".<br><br>
            Assurez-vous d'avoir bien lu et compris le contenu avant de continuer.
        `,
        confirmText: 'J\'ai compris, continuer →',
        cancelText: 'Rester sur cette étape',
        type: 'warning',
        onConfirm,
        onCancel
    });
};

const modalStyles = `
.confirm-modal {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
}

.modal-content {
    position: relative;
    background: var(--bg-card, #fff);
    border-radius: var(--radius-lg, 12px);
    max-width: 440px;
    width: 90%;
    padding: 1.5rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    animation: modalSlideIn 0.2s ease-out;
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.modal-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
}

.modal-icon {
    font-size: 1.5rem;
}

.modal-title {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-primary, #1a1a1a);
}

.modal-body {
    color: var(--text-secondary, #666);
    line-height: 1.6;
    margin-bottom: 1.5rem;
}

.modal-body p {
    margin: 0;
}

.modal-footer {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
}

.modal-footer button {
    padding: 0.625rem 1.25rem;
    border-radius: var(--radius-md, 8px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.modal-cancel {
    background: var(--bg-secondary, #f5f5f5);
    border: 1px solid var(--border, #ddd);
    color: var(--text-secondary, #666);
}

.modal-cancel:hover {
    background: var(--bg-hover, #eee);
}

.modal-confirm {
    background: var(--primary, #0066cc);
    border: none;
    color: white;
}

.modal-confirm:hover {
    background: var(--primary-hover, #0052a3);
}

.confirm-modal.danger .modal-confirm {
    background: var(--danger, #dc2626);
}

.confirm-modal.danger .modal-confirm:hover {
    background: var(--danger-hover, #b91c1c);
}
`;

if (!document.getElementById('confirmModalStyles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'confirmModalStyles';
    styleEl.textContent = modalStyles;
    document.head.appendChild(styleEl);
}
