/**
 * Debug Panel
 *
 * Admin/dev panel for managing user progress and debugging.
 * Opens on long-press of the debug FAB.
 *
 * Future: Access will be restricted to admin role via IAM/PAM.
 */

import { getState } from '../state.js';
import { apiPost, api, apiDelete } from '../api.js';
import { loadCourse } from '../course/loader.js';
import { setSafeHtml , safeHtml} from '../ui/safe-dom.js';
import { showToast } from '../../components/toast.js';
import { t } from '../../i18n/index.js';

let panelElement = null;
let isOpen = false;

const createPanel = () => {
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.className = 'debug-panel';
    setSafeHtml(panel, safeHtml`
        <div class="debug-panel__backdrop"></div>
        <div class="debug-panel__content">
            <div class="debug-panel__header">
                <h3>${t('debug.title')}</h3>
                <button class="debug-panel__close" data-testid="debug-panel-close" aria-label="${t('debug.close')}">✕</button>
            </div>
            <div class="debug-panel__body">
                <section class="debug-panel__section">
                    <h4>${t('debug.progression')}</h4>
                    <div class="debug-panel__info" id="debug-current-course">
                        ${t('debug.currentCourse')} <strong>—</strong>
                    </div>
                    <div class="debug-panel__actions">
                        <button id="debug-reset-current" class="debug-btn debug-btn--warning" data-testid="debug-reset-current-btn">
                            🔄 ${t('debug.resetCurrent')}
                        </button>
                        <button id="debug-reset-all" class="debug-btn debug-btn--danger" data-testid="debug-reset-all-btn">
                            ⚠️ ${t('debug.resetAll')}
                        </button>
                    </div>
                </section>
                <section class="debug-panel__section">
                    <h4>${t('debug.navigation')}</h4>
                    <div class="debug-panel__actions">
                        <button id="debug-goto-step" class="debug-btn" data-testid="debug-goto-step-btn">
                            ↗️ ${t('debug.gotoStep')}
                        </button>
                    </div>
                </section>
                <section class="debug-panel__section debug-panel__section--muted">
                    <p>${t('debug.devOnly1')}</p>
                    <p>${t('debug.devOnly2')}</p>
                </section>
            </div>
        </div>
    `);
    return panel;
};

const updatePanelState = () => {
    if (!panelElement) return;
    
    const currentCourse = getState('currentCourse');
    const courseData = getState('courseData');
    const infoEl = panelElement.querySelector('#debug-current-course');
    
    if (infoEl) {
        setSafeHtml(infoEl, safeHtml`${t('debug.currentCourse')} <strong>${courseData?.title || currentCourse || '—'}</strong>`);
    }
};

const handleResetCurrent = async () => {
    const currentCourse = getState('currentCourse');
    if (!currentCourse) {
        showToast(t('debug.noCourseSelected'), 'error');
        return;
    }

    const confirmed = confirm(t('debug.confirmResetCurrent', { course: currentCourse }));
    if (!confirmed) return;

    try {
        await apiDelete(`/signals/${currentCourse}`);
        showToast(t('debug.resetSuccess'), 'success');
        closePanel();
        loadCourse(currentCourse);
    } catch (error) {
        showToast(`❌ ${t('course.genericError', { msg: error.message })}`, 'error');
    }
};

const handleResetAll = async () => {
    const courses = getState('courses') || [];
    if (courses.length === 0) {
        showToast(t('debug.noCourseFound'), 'error');
        return;
    }

    const confirmed = confirm(t('debug.confirmResetAll', { n: courses.length }));
    if (!confirmed) return;

    try {
        let resetCount = 0;
        for (const course of courses) {
            await apiDelete(`/signals/${course.id}`);
            resetCount++;
        }
        showToast(t('debug.resetAllSuccess', { n: resetCount }), 'success');
        closePanel();

        const currentCourse = getState('currentCourse');
        if (currentCourse) {
            loadCourse(currentCourse);
        }
    } catch (error) {
        showToast(`❌ ${t('course.genericError', { msg: error.message })}`, 'error');
    }
};

const handleGotoStep = () => {
    const courseData = getState('courseData');
    const { classes = [] } = courseData ?? {};
    if (!classes.length) {
        showToast(t('debug.noCourseLoaded'), 'error');
        return;
    }

    const stepCount = classes.length;
    const input = prompt(t('debug.gotoPrompt', { n: stepCount }));
    if (!input) return;

    const stepNum = parseInt(input, 10);
    if (isNaN(stepNum) || stepNum < 1 || stepNum > stepCount) {
        showToast(t('debug.invalidStep', { n: stepCount }), 'error');
        return;
    }
    
    closePanel();
    window.navigateToStep?.(stepNum - 1);
};

const setupListeners = () => {
    if (!panelElement) return;
    
    panelElement.querySelector('.debug-panel__close')?.addEventListener('click', closePanel);
    
    panelElement.querySelector('.debug-panel__backdrop')?.addEventListener('click', closePanel);
    
    panelElement.querySelector('#debug-reset-current')?.addEventListener('click', handleResetCurrent);
    panelElement.querySelector('#debug-reset-all')?.addEventListener('click', handleResetAll);
    panelElement.querySelector('#debug-goto-step')?.addEventListener('click', handleGotoStep);
    
    document.addEventListener('keydown', handleEscape);
};

/**
 * Handle escape key
 */
const handleEscape = (e) => {
    if (e.key === 'Escape' && isOpen) {
        closePanel();
    }
}

/**
 * Open the debug panel
 */
export const openPanel = () => {
    if (isOpen) return;
    
    if (!panelElement) {
        panelElement = createPanel();
        document.body.appendChild(panelElement);
        setupListeners();
    }
    
    updatePanelState();
    
    requestAnimationFrame(() => {
        panelElement.classList.add('debug-panel--open');
    });
    
    isOpen = true;
};

/**
 * Close the debug panel
 */
export const closePanel = () => {
    if (!isOpen || !panelElement) return;
    
    panelElement.classList.remove('debug-panel--open');
    isOpen = false;
    
    document.removeEventListener('keydown', handleEscape);
}

/**
 * Toggle the panel
 */
export const togglePanel = () => {
    if (isOpen) {
        closePanel();
    } else {
        openPanel();
    }
};
