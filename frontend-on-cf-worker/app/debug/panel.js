/**
 * Debug Panel
 * 
 * Admin/dev panel for managing user progress and debugging.
 * Opens on long-press of the debug FAB.
 * 
 * Future: Access will be restricted to admin role via IAM/PAM.
 */

import { getState } from '../state.js';
import { apiPost, api } from '../api.js';
import { loadCourse } from '../course/loader.js';

const showToast = (...args) => window.showToast?.(...args);

let panelElement = null;
let isOpen = false;

/**
 * Create the debug panel DOM
 */
function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.className = 'debug-panel';
    panel.innerHTML = `
        <div class="debug-panel__backdrop"></div>
        <div class="debug-panel__content">
            <div class="debug-panel__header">
                <h3>🛠️ Console de Debug</h3>
                <button class="debug-panel__close" aria-label="Fermer">✕</button>
            </div>
            <div class="debug-panel__body">
                <section class="debug-panel__section">
                    <h4>Progression</h4>
                    <div class="debug-panel__info" id="debug-current-course">
                        Cours actuel: <strong>—</strong>
                    </div>
                    <div class="debug-panel__actions">
                        <button id="debug-reset-current" class="debug-btn debug-btn--warning">
                            🔄 Réinitialiser ce parcours
                        </button>
                        <button id="debug-reset-all" class="debug-btn debug-btn--danger">
                            ⚠️ Réinitialiser TOUS les parcours
                        </button>
                    </div>
                </section>
                <section class="debug-panel__section">
                    <h4>Navigation</h4>
                    <div class="debug-panel__actions">
                        <button id="debug-goto-step" class="debug-btn">
                            ↗️ Aller à une étape...
                        </button>
                    </div>
                </section>
                <section class="debug-panel__section debug-panel__section--muted">
                    <p>⚠️ Ces actions sont réservées au debug/développement.</p>
                    <p>En production, seuls les admins y auront accès.</p>
                </section>
            </div>
        </div>
    `;
    return panel;
}

/**
 * Update panel with current state
 */
function updatePanelState() {
    if (!panelElement) return;
    
    const currentCourse = getState('currentCourse');
    const courseData = getState('courseData');
    const infoEl = panelElement.querySelector('#debug-current-course');
    
    if (infoEl) {
        infoEl.innerHTML = `Cours actuel: <strong>${courseData?.title || currentCourse || '—'}</strong>`;
    }
}

/**
 * Handle reset current course
 */
async function handleResetCurrent() {
    const currentCourse = getState('currentCourse');
    if (!currentCourse) {
        showToast('Aucun cours sélectionné', 'error');
        return;
    }
    
    const confirmed = confirm(`Réinitialiser la progression de "${currentCourse}" ?`);
    if (!confirmed) return;
    
    try {
        await apiPost(`/signals/${currentCourse}/reset`, {});
        showToast('✅ Progression réinitialisée', 'success');
        closePanel();
        loadCourse(currentCourse);
    } catch (error) {
        showToast(`❌ Erreur: ${error.message}`, 'error');
    }
}

/**
 * Handle reset all courses
 */
async function handleResetAll() {
    const courses = getState('courses') || [];
    if (courses.length === 0) {
        showToast('Aucun cours trouvé', 'error');
        return;
    }
    
    const confirmed = confirm(
        `⚠️ ATTENTION ⚠️\n\n` +
        `Cela va réinitialiser la progression de ${courses.length} cours.\n` +
        `Cette action est irréversible.\n\n` +
        `Continuer ?`
    );
    if (!confirmed) return;
    
    try {
        let resetCount = 0;
        for (const course of courses) {
            await apiPost(`/signals/${course.id}/reset`, {});
            resetCount++;
        }
        showToast(`✅ ${resetCount} parcours réinitialisés`, 'success');
        closePanel();
        
        // Reload current course
        const currentCourse = getState('currentCourse');
        if (currentCourse) {
            loadCourse(currentCourse);
        }
    } catch (error) {
        showToast(`❌ Erreur: ${error.message}`, 'error');
    }
}

/**
 * Handle goto step
 */
function handleGotoStep() {
    const courseData = getState('courseData');
    if (!courseData?.classes?.length) {
        showToast('Aucun cours chargé', 'error');
        return;
    }
    
    const stepCount = courseData.classes.length;
    const input = prompt(`Aller à quelle étape ? (1-${stepCount})`);
    if (!input) return;
    
    const stepNum = parseInt(input, 10);
    if (isNaN(stepNum) || stepNum < 1 || stepNum > stepCount) {
        showToast(`Étape invalide (1-${stepCount})`, 'error');
        return;
    }
    
    closePanel();
    window.navigateToStep?.(stepNum - 1);
}

/**
 * Setup event listeners
 */
function setupListeners() {
    if (!panelElement) return;
    
    // Close button
    panelElement.querySelector('.debug-panel__close')?.addEventListener('click', closePanel);
    
    // Backdrop click
    panelElement.querySelector('.debug-panel__backdrop')?.addEventListener('click', closePanel);
    
    // Reset buttons
    panelElement.querySelector('#debug-reset-current')?.addEventListener('click', handleResetCurrent);
    panelElement.querySelector('#debug-reset-all')?.addEventListener('click', handleResetAll);
    panelElement.querySelector('#debug-goto-step')?.addEventListener('click', handleGotoStep);
    
    // Escape key
    document.addEventListener('keydown', handleEscape);
}

/**
 * Handle escape key
 */
function handleEscape(e) {
    if (e.key === 'Escape' && isOpen) {
        closePanel();
    }
}

/**
 * Open the debug panel
 */
export function openPanel() {
    if (isOpen) return;
    
    if (!panelElement) {
        panelElement = createPanel();
        document.body.appendChild(panelElement);
        setupListeners();
    }
    
    updatePanelState();
    
    // Trigger animation
    requestAnimationFrame(() => {
        panelElement.classList.add('debug-panel--open');
    });
    
    isOpen = true;
}

/**
 * Close the debug panel
 */
export function closePanel() {
    if (!isOpen || !panelElement) return;
    
    panelElement.classList.remove('debug-panel--open');
    isOpen = false;
    
    document.removeEventListener('keydown', handleEscape);
}

/**
 * Toggle the panel
 */
export function togglePanel() {
    if (isOpen) {
        closePanel();
    } else {
        openPanel();
    }
}
