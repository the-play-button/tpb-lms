/**
 * Debug FAB (Floating Action Button)
 * 
 * A floating button in the bottom-right corner that copies
 * debug information to clipboard when clicked.
 */

import { copyDebugInfoToClipboard } from './collector.js';
import { togglePanel } from './panel.js';

// showToast is exposed globally by components/toast.js
const showToast = (...args) => window.showToast?.(...args);

let fabElement = null;
let clickCount = 0;
let clickTimer = null;

/**
 * Create and mount the debug FAB
 */
export function initDebugFab() {
    if (fabElement) {
        console.warn('[Debug] FAB already initialized');
        return;
    }
    
    // Create FAB element
    fabElement = document.createElement('button');
    fabElement.id = 'debug-fab';
    fabElement.className = 'debug-fab';
    fabElement.setAttribute('aria-label', 'Copier les infos de debug');
    fabElement.setAttribute('title', 'Copier les infos techniques pour le support');
    fabElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
    `;
    
    // Click handler
    fabElement.addEventListener('click', handleFabClick);
    
    // Mount to body
    document.body.appendChild(fabElement);
    
    console.log('[Debug] FAB initialized');
}

/**
 * Handle FAB click - single click copies info, double click opens panel
 */
function handleFabClick() {
    clickCount++;
    
    if (clickCount === 1) {
        // Wait to see if it's a double-click
        clickTimer = setTimeout(async () => {
            clickCount = 0;
            await handleSingleClick();
        }, 250);
    } else if (clickCount === 2) {
        // Double-click: open debug panel
        clearTimeout(clickTimer);
        clickCount = 0;
        togglePanel();
    }
}

/**
 * Handle single click - copy debug info
 */
async function handleSingleClick() {
    // Add visual feedback
    fabElement.classList.add('debug-fab--loading');
    
    try {
        const result = await copyDebugInfoToClipboard();
        
        fabElement.classList.remove('debug-fab--loading');
        
        if (result.success) {
            fabElement.classList.add('debug-fab--success');
            setTimeout(() => fabElement.classList.remove('debug-fab--success'), 1500);
            
            showToast('📋 Infos copiées ! Double-clic pour console debug.', 'success');
            
            // Log for debugging
            console.log('[Debug] Info copied to clipboard:', result.data);
        } else {
            fabElement.classList.add('debug-fab--error');
            setTimeout(() => fabElement.classList.remove('debug-fab--error'), 1500);
            
            showToast('❌ Impossible de copier. Voir la console.', 'error');
            console.error('[Debug] Failed to copy:', result.error);
            console.log('[Debug] Data that should have been copied:', JSON.stringify(result.data, null, 2));
        }
    } catch (error) {
        fabElement.classList.remove('debug-fab--loading');
        fabElement.classList.add('debug-fab--error');
        setTimeout(() => fabElement.classList.remove('debug-fab--error'), 1500);
        
        showToast('❌ Erreur lors de la copie', 'error');
        console.error('[Debug] Error:', error);
    }
}

/**
 * Remove the FAB (for cleanup)
 */
export function destroyDebugFab() {
    if (fabElement) {
        fabElement.removeEventListener('click', handleFabClick);
        fabElement.remove();
        fabElement = null;
    }
}

