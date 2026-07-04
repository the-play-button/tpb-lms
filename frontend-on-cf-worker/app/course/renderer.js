/**
 * Course Step Renderer — thin orchestrator.
 *
 * Pure render helpers extracted to `renderer.functions/` per § lines_exceeded
 * doctrine « SPLIT into folder with barrel export. MECHANICAL REFACTORING
 * ONLY: never change logic during split. »
 *
 * Unified.to Conformity:
 * - Reads step_type from raw_json.tpb_step_type
 * - Fetches content from media[].url for DOCUMENT type
 */

import { getState } from '../state.js';
import { setupVideoTracking, getResumePosition } from '../video/tracking/index.js';
import { getDocumentMedia } from './renderer.functions/_mediaHelpers.js';
import { getStepContext } from './renderer.functions/stepContext.js';
import { renderVideoSection } from './renderer.functions/videoSection.js';
import { renderVideoContent, loadDocumentContent } from './renderer.functions/documentSection.js';
import { renderQuizSection } from './renderer.functions/quizSection.js';
import { renderRequirements } from './renderer.functions/requirements.js';
import { setSafeHtml, setSafeOuterHtml , safeHtml} from '../ui/safe-dom.js';

/**
 * Render current step (main orchestrator)
 */
export const renderCurrentStep = () => {
    const ctx = getStepContext();
    if (!ctx) return;

    const { cls, stepIndex, totalSteps, stepCompleted, videoId, videoYoutubeId, videoUrl, quizMedia } = ctx;
    const isLastStep = stepIndex === totalSteps - 1;

    const hasVideo = !!(videoId || videoYoutubeId || videoUrl || cls.content_md?.includes('cloudflarestream.com'));
    const hasQuiz = !!quizMedia;
    const isContentStep = !hasVideo && !hasQuiz;

    const canProceed = isContentStep || stepCompleted;

    const viewer = document.getElementById('somViewer');

    const videoHtml = renderVideoSection(ctx);

    setSafeHtml(viewer, safeHtml`
        <div class="step-viewer">
            <div class="step-header">
                <div class="step-progress">
                    <span class="step-counter">Étape ${stepIndex + 1} / ${totalSteps}</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${((stepIndex + 1) / totalSteps) * 100}%"></div>
                    </div>
                </div>
                <h2 class="step-title">${cls.name}</h2>
            </div>

            <div class="step-content markdown-body">
                ${renderVideoContent(ctx, videoHtml)}
            </div>

            ${renderQuizSection(ctx)}

            <div class="step-navigation">
                <button class="nav-btn prev" data-testid="nav-prev-btn" disabled title="Progression linéaire - pas de retour">← Précédent</button>
                <button class="nav-btn next" data-testid="nav-next-btn" ${canProceed ? '' : 'disabled'} onclick="window.nextStep()"
                    title="${!canProceed ? 'Complétez la vidéo et le quiz pour continuer' : (isLastStep ? 'Terminer le module' : 'Étape suivante')}">
                    ${isLastStep ? 'Terminer 🎉' : 'Suivant →'}
                </button>
            </div>

            ${renderRequirements(ctx)}
        </div>
    `);

    const resumePosition = getResumePosition(cls.id);
    setupVideoTracking(stepIndex, resumePosition);

    const documentMedia = getDocumentMedia(cls);
    if (documentMedia) {
        loadDocumentContent(cls);
    }
};

/**
 * Update UI elements without resetting the video iframe.
 */
export const updateUIWithoutVideoReset = () => {
    const ctx = getStepContext();
    if (!ctx) return;

    const { quizMedia, videoCompleted, quizPassed, stepCompleted } = ctx;

    // 1. Update requirements checklist
    const videoLi = document.querySelector('.step-requirements ul li:first-child');
    if (videoLi) {
        videoLi.className = videoCompleted ? 'done' : 'pending';
        setSafeHtml(videoLi, safeHtml`${videoCompleted ? '✅' : '⏳'} Regarder la vidéo à 90%+`);
    }

    // 2. Unlock quiz if video just completed
    if (quizMedia && videoCompleted && !quizPassed) {
        const quizSection = document.querySelector('.step-quiz.quiz-locked');
        if (quizSection) {
            setSafeOuterHtml(quizSection, renderQuizSection(ctx));
        }
    }

    // 3. Enable next/finish button if step completed
    const nextBtn = document.querySelector('.nav-btn.next');
    if (nextBtn && stepCompleted) {
        nextBtn.disabled = false;
        const course = getState('courseData');
        const stepIndex = getState('currentStepIndex');
        const isLastStep = stepIndex === course.classes.length - 1;
        nextBtn.title = isLastStep ? 'Terminer le module' : 'Étape suivante';
    }
};
