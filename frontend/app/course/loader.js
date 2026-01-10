/**
 * Course Loader
 * 
 * Handles loading course data and signals from API.
 * Supports multi-language via ?lang= parameter.
 */

import { api } from '../api.js';
import { getState, setState } from '../state.js';
import { stopVideoTracking } from '../video/tracking.js';
import { renderCurrentStep } from './renderer.js';
import { getLanguage } from '../../i18n/index.js';

/**
 * Load a course by ID
 * @param {string} courseId - The course ID to load
 * @param {number} initialStepIndex - Optional step index to navigate to (GAP-203)
 */
export async function loadCourse(courseId, initialStepIndex = null) {
    try {
        setState('currentCourse', courseId);
        
        // Sentry: Add course context for better error debugging
        if (window.Sentry) {
            window.Sentry.setTag('course_id', courseId);
            window.Sentry.addBreadcrumb({
                category: 'navigation',
                message: `Loading course: ${courseId}`,
                level: 'info'
            });
        }
        
        // Stop any existing video tracking
        stopVideoTracking();
        
        // Hide welcome screen
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        
        // Fetch course details (with language for translations)
        const lang = getLanguage();
        const course = await api(`/courses/${courseId}?lang=${lang}`);
        setState('courseData', course);
        
        // Fetch signals for this course
        const signals = await api(`/signals/${courseId}`);
        setState('signals', signals);
        
        // Determine step index (GAP-203: respect URL param if provided)
        let stepIndex;
        if (initialStepIndex !== null) {
            // Use requested step, but respect access limits
            stepIndex = Math.min(
                initialStepIndex,
                signals.can_access_step - 1,
                (course.classes?.length || 1) - 1
            );
        } else {
            // Default: last accessible step
            stepIndex = Math.min(
            signals.can_access_step - 1,
            (course.classes?.length || 1) - 1
        );
        }
        
        setState('currentStepIndex', Math.max(0, stepIndex));
        
        // Update URL to reflect current step (GAP-203)
        updateURL(courseId, stepIndex);
        
        // Always render current step on load
        // End screen only shown after clicking "Suivant" on last step
        renderCurrentStep();
        
    } catch (error) {
        console.error('Failed to load course:', error);
        document.getElementById('somViewer').innerHTML = `
            <div class="error">Erreur: ${error.message}</div>
        `;
    }
}

/**
 * Update URL with current course and step (GAP-203)
 */
export function updateURL(courseId, stepIndex) {
    const params = new URLSearchParams(window.location.search);
    params.set('som', courseId);
    params.set('step', stepIndex + 1); // 1-based pour l'URL
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    history.replaceState({ courseId, stepIndex }, '', newUrl);
}

/**
 * Refresh signals from API
 */
export async function refreshSignals() {
    const currentCourse = getState('currentCourse');
    if (!currentCourse) return null;
    
    try {
        const signals = await api(`/signals/${currentCourse}`);
        setState('signals', signals);
        return signals;
    } catch (error) {
        console.warn('Failed to refresh signals:', error.message);
        return null;
    }
}

