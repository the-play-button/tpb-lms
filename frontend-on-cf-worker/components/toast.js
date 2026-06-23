/**
 * Toast Component (ES module)
 *
 * Lightweight toast notifications inspired by shadcn/ui.
 *
 * The window.showToast bridge lives in app/init/globals.js per § global_pollution.
 * Direct consumers can:
 *   import { showToast } from '../../components/toast.js';
 *   showToast('Quiz débloqué !', 'success');
 */

const TOAST_EXIT_ANIMATION_MS = 300; // CSS toast slide-out animation duration
const MAX_VISIBLE_TOASTS = 2;
const toastQueue = [];
let container = null;

const ensureContainer = () => {
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
};

const processQueue = () => {
    if (toastQueue.length > 0) {
        const next = toastQueue.shift();
        showToast(next.message, next.type, next.duration);
    }
};

/**
 * Show a toast. Returns the DOM node so callers can dismiss early via
 * `dismissToast(toast)` — provides the cancellation path that satisfies
 * § JAMAIS DE setTimeout carve-out (debounce / cancellable timer pattern).
 */
export const showToast = (message, type = 'info', duration = 3000) => {
    const root = ensureContainer();

    const visibleToasts = root.querySelectorAll('.toast:not(.toast-hiding)');
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

    root.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
    });

    // Both timer handles attached to the node so callers (or unit tests, or
    // a page-navigation cleanup hook) can cancel via dismissToast().
    toast._hideTimer = setTimeout(() => {
        toast._hideTimer = null;
        toast.classList.remove('toast-visible');
        toast.classList.add('toast-hiding');

        const onExitEnd = () => {
            toast.remove();
            processQueue();
        };
        toast.addEventListener('transitionend', onExitEnd, { once: true });
    }, duration);

    return toast;
};

/**
 * Dismiss a toast early — cancels the pending hide timer and removes
 * the node immediately. Satisfies § JAMAIS DE setTimeout cancellation
 * path requirement (clearTimeout adjacent to setTimeout).
 */
export const dismissToast = (toast) => {
    if (!toast) return;
    if (toast._hideTimer) {
        clearTimeout(toast._hideTimer);
        toast._hideTimer = null;
    }
    toast.remove();
    processQueue();
};
