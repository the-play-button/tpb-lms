/**
 * Course Navigation
 * 
 * Handles step navigation (next, prev).
 */

import { getState, setState } from '../state.js';
import { apiPost, apiDelete } from '../api.js';
import { stopVideoTracking, cyclePlaybackSpeed } from '../video/tracking/index.js';
import { refreshSignals, updateURL } from './loader.js';
import { renderCurrentStep } from './renderer.js';
import { renderModuleEndScreen } from './endScreen.js';

/**
 * Navigate to a specific step (GAP-203)
 */
export const navigateToStep = stepIndex => {
    const courseId = getState('currentCourse');
    const signals = getState('signals');
    const courseData = getState('courseData');
    
    if (!courseData || !signals) return;
    
    const maxStep = Math.min(
        signals.can_access_step - 1,
        courseData.classes.length - 1
    );
    const targetStep = Math.max(0, Math.min(stepIndex, maxStep));
    
    setState('currentStepIndex', targetStep);
    stopVideoTracking();
    
    const params = new URLSearchParams(window.location.search);
    params.set('som', courseId);
    params.set('step', targetStep + 1); // 1-based pour l'URL
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    history.pushState({ courseId, stepIndex: targetStep }, '', newUrl);
    
    renderCurrentStep();
    window.scrollTo(0, 0);
};

/**
 * Go to next step
 */
export const nextStep = async () => {
    const signals = getState('signals');
    const stepIndex = getState('currentStepIndex');
    const stepSignal = signals?.steps?.[stepIndex];
    const courseData = getState('courseData');
    const currentClass = courseData?.classes?.[stepIndex];
    
    const media = currentClass?.media || [];
    const hasVideo = media.some(({ type } = {}) => type === 'VIDEO');
    const hasQuiz = media.some(({ type } = {}) => type === 'QUIZ');
    const isContentStep = !hasVideo && !hasQuiz;

    // Free-navigation courses skip the complete-to-proceed gate.
    const isLinear = (courseData?.progression_mode || 'linear') !== 'free';
    if (isLinear && !isContentStep && !stepSignal?.step_completed) {
        alert("Vous devez compléter cette étape avant de continuer.");
        return;
    }

    const courseId = getState('currentCourse');
    
    if (courseData && stepIndex < courseData.classes.length - 1) {
        const newStepIndex = stepIndex + 1;
        setState('currentStepIndex', newStepIndex);
        stopVideoTracking();
        
        const params = new URLSearchParams(window.location.search);
        params.set('som', courseId);
        params.set('step', newStepIndex + 1); // 1-based pour l'URL
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        history.pushState({ courseId, stepIndex: newStepIndex }, '', newUrl);
        
        const newSignals = await refreshSignals();
        
        if (newSignals?.course_completed) {
            renderModuleEndScreen();
        } else {
            renderCurrentStep();
        }
        
        window.scrollTo(0, 0);
    } else {
        await refreshSignals();
        renderModuleEndScreen();
    }
};

/**
 * Go to previous step. Blocked in linear mode ; free navigation steps back.
 */
export const prevStep = () => {
    const courseData = getState('courseData');
    if ((courseData?.progression_mode || 'linear') !== 'free') {
        alert("⚠️ Progression linéaire : impossible de revenir en arrière.");
        return;
    }
    const stepIndex = getState('currentStepIndex');
    if (stepIndex > 0) navigateToStep(stepIndex - 1);
};

/**
 * Restart module (reset all progress)
 */
export const restartModule = async () => {
    const confirmed = confirm(
        "⚠️ RECOMMENCER LE MODULE\n\n" +
        "Toute votre progression sera effacée.\n" +
        "Êtes-vous sûr ?"
    );
    
    if (confirmed) {
        const currentCourse = getState('currentCourse');
        try {
            await apiDelete(`/signals/${currentCourse}`);
            const { loadCourse } = await import('./loader.js');
            loadCourse(currentCourse);
        } catch (error) {
            alert(`Erreur: ${error.message}`);
        }
    }
};

const handlePopState = async event => {
    if (event.state?.stepIndex !== undefined) {
        const courseId = event.state.courseId || getState('currentCourse');
        const stepIndex = event.state.stepIndex;
        
        if (courseId === getState('currentCourse')) {
            setState('currentStepIndex', stepIndex);
            stopVideoTracking();
            renderCurrentStep();
        } else {
            const { loadCourse } = await import('./loader.js');
            loadCourse(courseId, stepIndex);
        }
    }
};

/**
 * Initialize navigation (= popstate listener only — global window.X
 * exposures live in app/init/globals.js per § global_pollution doctrine).
 */
export const initNavigation = () => {
    window.addEventListener('popstate', handlePopState);
};

