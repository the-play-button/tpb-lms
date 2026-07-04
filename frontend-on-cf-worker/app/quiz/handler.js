/**
 * Quiz Handler
 *
 * Handles quiz display, Tally form submission via postMessage.
 */

import { getState, setState } from '../state.js';
import { apiPost } from '../api.js';
import { log } from '../log.js';
import { refreshSignals } from '../course/loader.js';
import { renderCurrentStep } from '../course/renderer.js';
import { loadLeaderboard } from '../leaderboard.js';
import { refreshUserData } from '../notifications.js';
import { setSafeHtml , safeHtml, raw } from '../ui/safe-dom.js';
import { t } from '../../i18n/index.js';

const TALLY_EMBED_BASE_URL = 'https://tally.so/embed';

let currentQuizInfo = null;

const resolveTallyFormId = tallyFormIds => {
    if (!tallyFormIds) return null;
    
    if (typeof tallyFormIds === 'string') {
        return tallyFormIds;
    }
    
    if (typeof tallyFormIds === 'object') {
        const lang = window.i18n?.getLanguage?.() || 'fr';
        
        if (tallyFormIds[lang]) {
            return tallyFormIds[lang];
        }
        
        if (tallyFormIds['en']) {
            return tallyFormIds['en'];
        }
        
        const firstId = Object.values(tallyFormIds)[0];
        return firstId || null;
    }
    
    return null;
};

/**
 * Show quiz (triggered by button click)
 * Supports both single tallyFormId (string) and per-language tally_form_ids object.
 * 
 * @param {string} classId - The class ID
 * @param {string|object} tallyFormIds - Single ID (string) or { lang: id } object
 * @param {string} quizName - Quiz name for display
 */
export const showQuiz = (classId, tallyFormIds, quizName) => {
    const tallyFormId = resolveTallyFormId(tallyFormIds);
    
    if (!tallyFormId) {
        alert(t('quiz.notAvailableLang'));
        return;
    }

    const confirmed = confirm(t('quiz.attemptWarning'));
    
    if (confirmed) {
        currentQuizInfo = {
            classId,
            tallyFormId,
            courseId: getState('currentCourse')
        };
        
        const container = document.getElementById(`quiz-container-${classId}`);
        if (container) {
            container.style.display = 'block';
            setSafeHtml(container, safeHtml`
                <iframe
                    src="${TALLY_EMBED_BASE_URL}/${tallyFormId}?alignLeft=1&hideTitle=1&dynamicHeight=1"
                    width="100%"
                    height="500"
                    frameborder="0"
                    style="border-radius: 8px; background: #ffffff;">
                </iframe>
            `);
            const startBtn = container.previousElementSibling;
            if (startBtn?.classList.contains('quiz-start-btn')) {
                startBtn.style.display = 'none';
            }
            container.scrollIntoView({ behavior: 'smooth' });
        }
    }
};

/**
 * Handle Tally form submission via postMessage
 */
export const handleTallySubmission = async tallyEvent => {
    log.debug('📋 Quiz Tally submitted!', tallyEvent.payload);
    log.debug('📋 [DEBUG] currentQuizInfo:', currentQuizInfo);
    
    if (!currentQuizInfo) {
        log.error('❌ No quiz info stored - cannot process submission');
        return;
    }
    
    showQuizPendingState();
    
    const payload = {
        quizId: currentQuizInfo.tallyFormId,
        courseId: currentQuizInfo.courseId,
        classId: currentQuizInfo.classId,
        answers: tallyEvent.payload?.fields || []
    };
    
    try {
        log.debug('📤 [DEBUG] Calling /api/quiz-submissions with payload:', payload);
        const result = await apiPost('/quiz-submissions', payload);
        
        log.debug('📥 [DEBUG] Quiz API response:', result);
        
        if (result.passed) {
            log.debug('✅ Quiz passed!');
            
            if (result.wrongAnswers && result.wrongAnswers.length > 0) {
                showCorrectionsModal(result.wrongAnswers, result.score, result.maxScore);
            } else {
                showToast(`${t('quiz.perfectToast', { score: result.score, max: result.maxScore })} 🎉`, 'success');
            }

            if (result.xpAwarded) {
                showToast(t('quiz.pointsToast', { points: result.xpAwarded }), 'points', 4000);
            }
            if (result.badgeEarned) {
                showToast(t('badge.earnedToast', { name: result.badgeEarned.name }), 'achievement');
            }
            
            loadLeaderboard();
            refreshUserData();
        } else {
            log.debug('❌ Quiz failed - must rewatch video');
            showFailureModal(result.score, result.maxScore, result.percentage);
        }
        
        await refreshSignals();
        renderCurrentStep();
        
    } catch (error) {
        log.error('❌ [DEBUG] Failed to submit quiz:', error);
        alert(t('quiz.submitError'));
    }
};

/**
 * Show corrections modal for passed quiz (with errors)
 * Only shown when user passed but didn't get 100%
 */
const showCorrectionsModal = (wrongAnswers, score, maxScore) => {
    const modal = document.createElement('div');
    modal.className = 'quiz-modal-overlay';
    setSafeHtml(modal, safeHtml`
        <div class="quiz-modal quiz-success">
            <div class="quiz-modal-header">
                <span class="quiz-modal-icon">✅</span>
                <h3>${t('quiz.passedTitle', { score, max: maxScore })}</h3>
            </div>
            <p>${t('quiz.missedQuestions')}</p>
            <ul class="corrections-list">
                ${raw(wrongAnswers.map(({ question, yourAnswer, correctAnswer } = {}) => safeHtml`
                    <li class="correction-item">
                        <div class="correction-question">${question}</div>
                        <div class="correction-wrong">
                            <span class="label">${t('quiz.yourAnswer')}</span> ${yourAnswer}
                        </div>
                        <div class="correction-correct">
                            <span class="label">${t('quiz.correctAnswer')}</span> ${correctAnswer}
                        </div>
                    </li>
                `).join(''))}
            </ul>
            <button class="quiz-modal-btn" data-testid="quiz-success-continue-btn" onclick="this.closest('.quiz-modal-overlay').remove()">
                ${t('nav.continue')}
            </button>
        </div>
    `);
    document.body.appendChild(modal);
}

/**
 * Show failure modal when quiz not passed
 * User must rewatch video before retrying
 */
const showFailureModal = (score, maxScore, percentage) => {
    const modal = document.createElement('div');
    modal.className = 'quiz-modal-overlay';
    setSafeHtml(modal, safeHtml`
        <div class="quiz-modal quiz-failure">
            <div class="quiz-modal-header">
                <span class="quiz-modal-icon">❌</span>
                <h3>${t('quiz.failedTitle', { score, max: maxScore })}</h3>
            </div>
            <p class="failure-score">${t('quiz.scoreLabel', { percentage })}</p>
            <p class="failure-message">
                ${t('quiz.belowMinimum')}
            </p>
            <p class="failure-instruction">
                <strong>${t('quiz.mustRewatch')}</strong>
            </p>
            <button class="quiz-modal-btn" data-testid="quiz-failure-dismiss-btn" onclick="this.closest('.quiz-modal-overlay').remove()">
                ${t('quiz.understood')}
            </button>
        </div>
    `);
    document.body.appendChild(modal);
}

/**
 * Show pending state in quiz UI while processing
 */
const showQuizPendingState = () => {
    const quizSection = document.querySelector('.step-quiz');
    if (!quizSection) return;
    
    quizSection.className = 'step-quiz quiz-pending';
    
    const quizContainer = quizSection.querySelector('.quiz-container');
    if (quizContainer && quizContainer.style.display !== 'none') {
        setSafeHtml(quizContainer, safeHtml`
            <div class="quiz-pending-message">
                <div class="spinner"></div>
                <p>${t('quiz.validating')}</p>
                <p class="pending-subtext">${t('quiz.submittingWait')}</p>
            </div>
        `);
    }
    
    const requirementsEl = document.querySelector('.step-requirements ul');
    if (requirementsEl) {
        const quizLi = requirementsEl.querySelector('li:last-child');
        if (quizLi && quizLi.textContent.includes('quiz')) {
            setSafeHtml(quizLi, safeHtml`⏳ Validation du quiz en cours...`);
            quizLi.className = 'pending validating';
        }
    }
    
    log.debug('🔄 Quiz pending state shown');
}

/**
 * Initialize quiz handler (= no-op currently ; window.showQuiz exposure
 * lives in app/init/globals.js per § global_pollution doctrine).
 */
export const initQuizHandler = () => {};

