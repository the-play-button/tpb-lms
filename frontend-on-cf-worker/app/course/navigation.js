/**
 * Course Navigation
 * 
 * Handles step navigation (next, prev).
 */

import { getState, setState } from '../state.js';
import { apiPost } from '../api.js';
import { stopVideoTracking, cyclePlaybackSpeed } from '../video/tracking.js';
import { refreshSignals, updateURL } from './loader.js';
import { renderCurrentStep } from './renderer.js';
import { renderModuleEndScreen } from './endScreen.js';

/**
 * Navigate to a specific step (GAP-203)
 */
export function navigateToStep(stepIndex) {
    const courseId = getState('currentCourse');
    const signals = getState('signals');
    const courseData = getState('courseData');
    
    if (!courseData || !signals) return;
    
    // Clamp to valid range and respect access limits
    const maxStep = Math.min(
        signals.can_access_step - 1,
        courseData.classes.length - 1
    );
    const targetStep = Math.max(0, Math.min(stepIndex, maxStep));
    
    setState('currentStepIndex', targetStep);
    stopVideoTracking();
    
    // Update URL with pushState (GAP-203)
    const params = new URLSearchParams(window.location.search);
    params.set('som', courseId);
    params.set('step', targetStep + 1); // 1-based pour l'URL
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    history.pushState({ courseId, stepIndex: targetStep }, '', newUrl);
    
    renderCurrentStep();
    window.scrollTo(0, 0);
}

/**
 * Go to next step
 */
export async function nextStep() {
    const signals = getState('signals');
    const stepIndex = getState('currentStepIndex');
    const stepSignal = signals?.steps?.[stepIndex];
    const courseData = getState('courseData');
    const currentClass = courseData?.classes?.[stepIndex];
    
    // Check if this is a CONTENT step (no video, no quiz in media)
    const media = currentClass?.media || [];
    const hasVideo = media.some(m => m.type === 'VIDEO');
    const hasQuiz = media.some(m => m.type === 'QUIZ');
    const isContentStep = !hasVideo && !hasQuiz;
    
    // CONTENT steps can always advance; VIDEO/QUIZ need completion
    if (!isContentStep && !stepSignal?.step_completed) {
        alert("Vous devez compléter cette étape avant de continuer.");
        return;
    }
    
    const courseId = getState('currentCourse');
    
    if (courseData && stepIndex < courseData.classes.length - 1) {
        const newStepIndex = stepIndex + 1;
        setState('currentStepIndex', newStepIndex);
        stopVideoTracking();
        
        // Update URL with pushState (GAP-203)
        const params = new URLSearchParams(window.location.search);
        params.set('som', courseId);
        params.set('step', newStepIndex + 1); // 1-based pour l'URL
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        history.pushState({ courseId, stepIndex: newStepIndex }, '', newUrl);
        
        // Refresh signals
        const newSignals = await refreshSignals();
        
        if (newSignals?.course_completed) {
            renderModuleEndScreen();
        } else {
            renderCurrentStep();
        }
        
        window.scrollTo(0, 0);
    } else {
        // Last step - show end screen
        await refreshSignals();
        renderModuleEndScreen();
    }
}

/**
 * Go to previous step (disabled for linear progression)
 */
export function prevStep() {
    alert("⚠️ Progression linéaire : impossible de revenir en arrière.");
}

/**
 * Restart module (reset all progress)
 */
export async function restartModule() {
    const confirmed = confirm(
        "⚠️ RECOMMENCER LE MODULE\n\n" +
        "Toute votre progression sera effacée.\n" +
        "Êtes-vous sûr ?"
    );
    
    if (confirmed) {
        const currentCourse = getState('currentCourse');
        try {
            await apiPost(`/signals/${currentCourse}/reset`, {});
            // Reload course
            const { loadCourse } = await import('./loader.js');
            loadCourse(currentCourse);
        } catch (error) {
            alert(`Erreur: ${error.message}`);
        }
    }
}

/**
 * Handle browser back/forward buttons (GAP-203)
 */
async function handlePopState(event) {
    if (event.state?.stepIndex !== undefined) {
        const courseId = event.state.courseId || getState('currentCourse');
        const stepIndex = event.state.stepIndex;
        
        // If same course, just navigate to step
        if (courseId === getState('currentCourse')) {
            setState('currentStepIndex', stepIndex);
            stopVideoTracking();
            renderCurrentStep();
        } else {
            // Different course, use dynamic import to avoid circular dependency
            const { loadCourse } = await import('./loader.js');
            loadCourse(courseId, stepIndex);
        }
    }
}

/**
 * Expose navigation functions globally
 */
export function initNavigation() {
    window.nextStep = nextStep;
    window.prevStep = prevStep;
    window.restartModule = restartModule;
    window.navigateToStep = navigateToStep;
    window.cycleSpeed = cyclePlaybackSpeed; // GAP-101: Playback speed control
    
    // Handle browser back/forward (GAP-203)
    window.addEventListener('popstate', handlePopState);
}

