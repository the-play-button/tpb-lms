/**
 * Quiz Handler
 * 
 * Handles quiz display, Tally form submission via postMessage.
 */

import { getState, setState } from '../state.js';
import { apiPost } from '../api.js';
import { refreshSignals } from '../course/loader.js';
import { renderCurrentStep } from '../course/renderer.js';
import { loadLeaderboard } from '../leaderboard.js';
import { refreshUserData } from '../notifications.js';

// Current quiz info for postMessage handler
let currentQuizInfo = null;

/**
 * Show quiz (triggered by button click)
 */
export function showQuiz(classId, tallyFormId, quizName) {
    const confirmed = confirm(
`⚠️ ATTENTION - UNE SEULE TENTATIVE

En cliquant OK, vous acceptez :
• Une seule tentative pour ce quiz
• Résultats définitifs

Êtes-vous prêt ?`
    );
    
    if (confirmed) {
        // Store quiz info for postMessage handler
        currentQuizInfo = {
            classId,
            tallyFormId,
            courseId: getState('currentCourse')
        };
        
        const container = document.getElementById(`quiz-container-${classId}`);
        if (container) {
            container.style.display = 'block';
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
}

/**
 * Handle Tally form submission via postMessage
 */
export async function handleTallySubmission(tallyEvent) {
    console.log('📋 Quiz Tally submitted!', tallyEvent.payload);
    console.log('📋 [DEBUG] currentQuizInfo:', currentQuizInfo);
    
    if (!currentQuizInfo) {
        console.error('❌ No quiz info stored - cannot process submission');
        return;
    }
    
    // Show pending state in quiz UI
    showQuizPendingState();
    
    const payload = {
        quizId: currentQuizInfo.tallyFormId,
        courseId: currentQuizInfo.courseId,
        classId: currentQuizInfo.classId,
        // Score calculé côté serveur pour sécurité
        answers: tallyEvent.payload?.fields || []
    };
    
    try {
        // Call our API directly
        console.log('📤 [DEBUG] Calling /api/quiz with payload:', payload);
        const result = await apiPost('/quiz', payload);
        
        console.log('📥 [DEBUG] Quiz API response:', result);
        
        if (result.passed) {
            // REUSSITE: Afficher corrections si pas 100%
            console.log('✅ Quiz passed!');
            
            if (result.wrongAnswers && result.wrongAnswers.length > 0) {
                // Afficher le modal avec les corrections
                showCorrectionsModal(result.wrongAnswers, result.score, result.maxScore);
            } else {
                // Score parfait - simple toast
                showToast(`Quiz parfait ! ${result.score}/${result.maxScore} 🎉`, 'success');
            }
            
            if (result.xpAwarded) {
                showToast(`+${result.xpAwarded} points`, 'points', 4000);
            }
            if (result.badgeEarned) {
                showToast(`Badge débloqué : ${result.badgeEarned.name}`, 'achievement');
            }
            
            // Refresh points in sidebar
            loadLeaderboard();
            // Refresh user data for badges
            refreshUserData();
        } else {
            // ECHEC: Afficher modal d'échec (video_completed a été reset côté backend)
            console.log('❌ Quiz failed - must rewatch video');
            showFailureModal(result.score, result.maxScore, result.percentage);
        }
        
        // Refresh signals and update UI (important pour reverrouiller le quiz si échec)
        await refreshSignals();
        renderCurrentStep();
        
    } catch (error) {
        console.error('❌ [DEBUG] Failed to submit quiz:', error);
        alert('Erreur lors de la soumission du quiz. Veuillez rafraîchir la page.');
    }
}

/**
 * Show corrections modal for passed quiz (with errors)
 * Only shown when user passed but didn't get 100%
 */
function showCorrectionsModal(wrongAnswers, score, maxScore) {
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
                ${wrongAnswers.map(w => `
                    <li class="correction-item">
                        <div class="correction-question">${w.question}</div>
                        <div class="correction-wrong">
                            <span class="label">Votre réponse :</span> ${w.yourAnswer}
                        </div>
                        <div class="correction-correct">
                            <span class="label">Bonne réponse :</span> ${w.correctAnswer}
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
function showFailureModal(score, maxScore, percentage) {
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
function showQuizPendingState() {
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
    
    console.log('🔄 Quiz pending state shown');
}

/**
 * Initialize quiz handler (expose to window)
 */
export function initQuizHandler() {
    window.showQuiz = showQuiz;
}

