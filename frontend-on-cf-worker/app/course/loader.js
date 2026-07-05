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
import { setSafeHtml } from '../ui/safe-dom.js';

/**
 * Load a course by ID
 * @param {string} courseId - The course ID to load
 * @param {number} initialStepIndex - Optional step index to navigate to (GAP-203)
 */
export const loadCourse = async (courseId, initialStepIndex = null) => {
    try {
        setState('currentCourse', courseId);
        // Keep the rail scoped to this course's program (derive from the course list).
        const owningProgram = (getState('courses') || []).find((c) => c.id === courseId)?.program_id ?? null;
        setState('currentProgram', owningProgram);

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
        
        const classes = course.classes || [];
        const lastIndex = Math.max(0, classes.length - 1);
        let stepIndex;
        if (initialStepIndex !== null) {
            // Explicit deep-link (e.g. ?step=): honour it, but never jump past a linear
            // lock. In free mode can_access_step === total, so this clamp is a no-op.
            stepIndex = Math.min(initialStepIndex, signals.can_access_step - 1, lastIndex);
        } else {
            // Resume where the learner left off = the FIRST lesson they haven't completed
            // yet (in order). Works identically for linear and free. First time in a
            // course → step 0 ; everything done → back to the start for review.
            //
            // We deliberately do NOT use can_access_step here: it's the *accessibility
            // ceiling*, and for a free course it equals the total step count, which sent
            // every "Start" to the LAST lesson (the old linear-only assumption leaking).
            const completed = new Set(
                (signals.steps || []).filter((s) => s.step_completed).map((s) => s.class_id),
            );
            const firstUnfinished = classes.findIndex((c) => !completed.has(c.id));
            stepIndex = firstUnfinished < 0 ? 0 : firstUnfinished;
        }

        stepIndex = Math.max(0, Math.min(stepIndex, lastIndex));
        setState('currentStepIndex', stepIndex);
        
        updateURL(courseId, stepIndex);
        
        renderCurrentStep();
        
    } catch (error) {
        log.error('Failed to load course:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = `Erreur: ${error.message}`;
        const viewer = document.getElementById('somViewer');
        setSafeHtml(viewer, '');
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

