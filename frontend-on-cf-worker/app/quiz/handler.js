// entropy-single-export-ok: 3 tightly-coupled quiz handlers (show, handle submission, init) sharing Tally integration state
// entropy-legacy-marker-ok: debt — supports legacy single-string tallyFormId alongside new multi-lang tally_form_ids object format
// entropy-hardcoded-url-ok: URL is stable
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

let currentQuizInfo = null;

const resolveTallyFormId = tallyFormIds => {
    if (!tallyFormIds) return null;
    
    // entropy-legacy-marker-ok: documented technical debt
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
 * Supports both legacy single tallyFormId and new tally_form_ids object. entropy-legacy-marker-ok: documented technical debt
 * 
 * @param {string} classId - The class ID
 * @param {string|object} tallyFormIds - Single ID (legacy) or { lang: id } object entropy-legacy-marker-ok: documented technical debt
 * @param {string} quizName - Quiz name for display
 */
export const showQuiz = (classId, tallyFormIds, quizName) => {
    const tallyFormId = resolveTallyFormId(tallyFormIds);
    
    if (!tallyFormId) {
        alert('Quiz non disponible dans cette langue.');
        return;
    }
    
    const confirmed = confirm(
`⚠️ ATTENTION - UNE SEULE TENTATIVE

En cliquant OK, vous acceptez :
• Une seule tentative pour ce quiz
• Résultats définitifs

Êtes-vous prêt ?`
    );
    
    if (confirmed) {
        currentQuizInfo = {
            classId,
            tallyFormId,
            courseId: getState('currentCourse')
        };
        
        const container = document.getElementById(`quiz-container-${classId}`);
        if (container) {
            container.style.display = 'block';
            // entropy-hardcoded-url-ok: Tally.so embed URL
            container.innerHTML = `
                <iframe
                    src="https://tally.so/embed/${tallyFormId}?alignLeft=1&hideTitle=1&dynamicHeight=1"
                    width="100%"
                    height="500"
                    frameborder="0"
                    style="border-radius: 8px; background: #ffffff;">
                </iframe>
            `;
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
        log.debug('📤 [DEBUG] Calling /api/quiz with payload:', payload);
        const result = await apiPost('/quiz', payload);
        
        log.debug('📥 [DEBUG] Quiz API response:', result);
        
        if (result.passed) {
            log.debug('✅ Quiz passed!');
            
            if (result.wrongAnswers && result.wrongAnswers.length > 0) {
                showCorrectionsModal(result.wrongAnswers, result.score, result.maxScore);
            } else {
                showToast(`Quiz parfait ! ${result.score}/${result.maxScore} 🎉`, 'success');
            }
            
            if (result.xpAwarded) {
                showToast(`+${result.xpAwarded} points`, 'points', 4000);
            }
            if (result.badgeEarned) {
                showToast(`Badge débloqué : ${result.badgeEarned.name}`, 'achievement');
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
        alert('Erreur lors de la soumission du quiz. Veuillez rafraîchir la page.');
    }
};

/**
 * Show corrections modal for passed quiz (with errors)
 * Only shown when user passed but didn't get 100%
 */
const showCorrectionsModal = (wrongAnswers, score, maxScore) => {
    const modal = document.createElement('div');
    modal.className = 'quiz-modal-overlay';
    modal.innerHTML = `
        <div class="quiz-modal quiz-success">
            <div class="quiz-modal-header">
                <span class="quiz-modal-icon">✅</span>
                <h3>Quiz réussi ! (${score}/${maxScore})</h3>
            </div>
            <p>Voici les questions que vous avez ratées :</p>
            <ul class="corrections-list">
                ${wrongAnswers.map(({ question, yourAnswer, correctAnswer }) => `
                    <li class="correction-item">
                        <div class="correction-question">${question}</div>
                        <div class="correction-wrong">
                            <span class="label">Votre réponse :</span> ${yourAnswer}
                        </div>
                        <div class="correction-correct">
                            <span class="label">Bonne réponse :</span> ${correctAnswer}
                        </div>
                    </li>
                `).join('')}
            </ul>
            <button class="quiz-modal-btn" onclick="this.closest('.quiz-modal-overlay').remove()">
                Continuer
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

/**
 * Show failure modal when quiz not passed
 * User must rewatch video before retrying
 */
const showFailureModal = (score, maxScore, percentage) => {
    const modal = document.createElement('div');
    modal.className = 'quiz-modal-overlay';
    modal.innerHTML = `
        <div class="quiz-modal quiz-failure">
            <div class="quiz-modal-header">
                <span class="quiz-modal-icon">❌</span>
                <h3>Quiz non réussi (${score}/${maxScore})</h3>
            </div>
            <p class="failure-score">Score : ${percentage}%</p>
            <p class="failure-message">
                Vous n'avez pas atteint le score minimum requis.
            </p>
            <p class="failure-instruction">
                <strong>Vous devez revoir la vidéo avant de retenter le quiz.</strong>
            </p>
            <button class="quiz-modal-btn" onclick="this.closest('.quiz-modal-overlay').remove()">
                Compris
            </button>
        </div>
    `;
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
        quizContainer.innerHTML = `
            <div class="quiz-pending-message">
                <div class="spinner"></div>
                <p>Validation en cours...</p>
                <p class="pending-subtext">Veuillez patienter pendant que nous enregistrons votre résultat.</p>
            </div>
        `;
    }
    
    const requirementsEl = document.querySelector('.step-requirements ul');
    if (requirementsEl) {
        const quizLi = requirementsEl.querySelector('li:last-child');
        if (quizLi && quizLi.textContent.includes('quiz')) {
            quizLi.innerHTML = `⏳ Validation du quiz en cours...`;
            quizLi.className = 'pending validating';
        }
    }
    
    log.debug('🔄 Quiz pending state shown');
}

/**
 * Initialize quiz handler (expose to window)
 */
export const initQuizHandler = () => {
    window.showQuiz = showQuiz; // entropy-global-pollution-ok: intentional global for HTML onclick
};

