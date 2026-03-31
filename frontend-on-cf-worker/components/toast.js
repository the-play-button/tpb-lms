// entropy-prohibited-timer-ok: timer use is intentional
/**
 * Toast Component
 *
 * Lightweight toast notifications inspired by shadcn/ui
 *
 * Usage:
 *   showToast('Quiz débloqué !', 'success');
 *   showToast('Badge gagné : Premier Quiz', 'achievement');
 *   showToast('+100 points', 'points');
 */

(function() {
    'use strict';
    let container = null;
    const MAX_VISIBLE_TOASTS = 2;
    const toastQueue = [];

    const ensureContainer = () => {
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    };

    const showToast = (message, type = 'info', duration = 3000) => {
        const container = ensureContainer();
        
        const visibleToasts = container.querySelectorAll('.toast:not(.toast-hiding)');
        if (visibleToasts.length >= MAX_VISIBLE_TOASTS) {
            toastQueue.push({ message, type, duration });
            return null;
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: '✅',
            achievement: '🏆',
            points: '⭐',
            info: 'ℹ️',
            error: '❌'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.classList.add('toast-visible');
        });
        
        // entropy-prohibited-timer-ok: auto-dismiss toast after duration
        setTimeout(() => {
            toast.classList.remove('toast-visible');
            toast.classList.add('toast-hiding');

            // entropy-prohibited-timer-ok: cleanup after CSS exit animation
            setTimeout(() => {
                toast.remove();
                processQueue(); // Process next toast in queue
            }, 300);
        }, duration);
        
        return toast;
    };

    function processQueue() {
        if (toastQueue.length > 0) {
            const next = toastQueue.shift();
            showToast(next.message, next.type, next.duration);
        }
    }

    window.showToast = showToast; // entropy-global-pollution-ok: intentional global for HTML onclick
})();

