// entropy-god-file-ok: course data loader
// entropy-single-export-ok: 3 tightly-coupled course loader functions (load, updateURL, refreshSignals) sharing state management
/**
 * Course Loader
 *
 * Handles loading course data and signals from API.
 * Supports multi-language via ?lang= parameter.
 */

import { api } from '../api.js';
import { getState, setState } from '../state.js';
import { log } from '../log.js';
import { stopVideoTracking } from '../video/tracking/index.js';
import { renderCurrentStep } from './renderer.js';
import { getLanguage } from '../../i18n/index.js';

/**
 * Load a course by ID
 * @param {string} courseId - The course ID to load
 * @param {number} initialStepIndex - Optional step index to navigate to (GAP-203)
 */
export const loadCourse = async (courseId, initialStepIndex = null) => {
    try {
        setState('currentCourse', courseId);
        
        if (window.Sentry) {
            window.Sentry.setTag('course_id', courseId);
            window.Sentry.addBreadcrumb({
                category: 'navigation',
                message: `Loading course: ${courseId}`,
                level: 'info'
            });
        }
        
        stopVideoTracking();
        
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        
        const lang = getLanguage();
        const course = await api(`/courses/${courseId}?lang=${lang}`);
        setState('courseData', course);
        
        const signals = await api(`/signals/${courseId}`);
        setState('signals', signals);
        
        let stepIndex;
        if (initialStepIndex !== null) {
            stepIndex = Math.min(
                initialStepIndex,
                signals.can_access_step - 1,
                (course.classes?.length || 1) - 1
            );
        } else {
            stepIndex = Math.min(
            signals.can_access_step - 1,
            (course.classes?.length || 1) - 1
        );
        }
        
        setState('currentStepIndex', Math.max(0, stepIndex));
        
        updateURL(courseId, stepIndex);
        
        renderCurrentStep();
        
    } catch (error) {
        log.error('Failed to load course:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = `Erreur: ${error.message}`;
        const viewer = document.getElementById('somViewer');
        viewer.innerHTML = '';
        viewer.appendChild(errorDiv);
    }
};

/**
 * Update URL with current course and step (GAP-203)
 */
export const updateURL = (courseId, stepIndex) => {
    const params = new URLSearchParams(window.location.search);
    params.set('som', courseId);
    params.set('step', stepIndex + 1); // 1-based pour l'URL
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    history.replaceState({ courseId, stepIndex }, '', newUrl);
}

/**
 * Refresh signals from API
 */
export const refreshSignals = async () => {
    const currentCourse = getState('currentCourse');
    if (!currentCourse) return null;
    
    try {
        const signals = await api(`/signals/${currentCourse}`);
        setState('signals', signals);
        return signals;
    } catch (error) {
        log.warn('Failed to refresh signals:', error.message);
        return null;
    }
};

