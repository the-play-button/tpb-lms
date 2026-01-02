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
    
    // Create toast container on load
    let container = null;
    const MAX_VISIBLE_TOASTS = 2;
    const toastQueue = [];
    
    function ensureContainer() {
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }
    
    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - Toast type: 'success', 'achievement', 'points', 'info', 'error'
     * @param {number} duration - Duration in ms (default: 3000)
     */
    function showToast(message, type = 'info', duration = 3000) {
        const container = ensureContainer();
        
        // Limiter les toasts visibles
        const visibleToasts = container.querySelectorAll('.toast:not(.toast-hiding)');
        if (visibleToasts.length >= MAX_VISIBLE_TOASTS) {
            // Queue le toast pour plus tard
            toastQueue.push({ message, type, duration });
            return null;
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Icon based on type
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
        
        // Add to container
        container.appendChild(toast);
        
        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('toast-visible');
        });
        
        // Remove after duration
        setTimeout(() => {
            toast.classList.remove('toast-visible');
            toast.classList.add('toast-hiding');
            
            // Remove from DOM after animation
            setTimeout(() => {
                toast.remove();
                processQueue(); // Process next toast in queue
            }, 300);
        }, duration);
        
        return toast;
    }
    
    function processQueue() {
        if (toastQueue.length > 0) {
            const next = toastQueue.shift();
            showToast(next.message, next.type, next.duration);
        }
    }
    
    // Expose globally
    window.showToast = showToast;
    
})();

