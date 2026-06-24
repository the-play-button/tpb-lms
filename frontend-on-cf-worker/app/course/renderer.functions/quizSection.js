/**
 * Quiz section renderer — locked / unlocked / passed states + Tally form
 * trigger button.
 */

import { escapeHtml, safeHtml, raw } from '../../ui/safe-dom.js';

export const renderQuizSection = ctx => {
    const { cls, quizMedia, videoCompleted, quizPassed } = ctx;

    if (!quizMedia) return '';

    const quizName = quizMedia.name || 'Quiz de validation';

    // SSOT-escaped JSON payload for the `onclick` JS argument. JSON.stringify
    // produces a valid JS literal (object → `{...}`, string → `"..."`,
    // number → `123`). `escapeHtml` then quotes-encode the result so the
    // browser decodes back to the original JS expression at parse time.
    const formIds = quizMedia.tally_form_ids || quizMedia.tally_form_id;
    const formIdsJson = escapeHtml(JSON.stringify(formIds));
    const quizNameJsEscaped = quizName.replace(/'/g, "\\'");
    const onclickHandler = `window.showQuiz('${cls.id}', ${formIdsJson}, '${quizNameJsEscaped}')`;

    if (quizPassed) {
        return safeHtml`
            <div class="step-quiz quiz-passed">
                <div class="quiz-header">
                    <h3>🎯 ${quizName}</h3>
                    <span class="quiz-badge">✅ Quiz réussi</span>
                </div>
            </div>
        `;
    }

    if (!videoCompleted) {
        return safeHtml`
            <div class="step-quiz quiz-locked">
                <div class="quiz-header">
                    <h3>🎯 ${quizName}</h3>
                    <span class="quiz-badge">🔒 Verrouillé</span>
                </div>
                <p class="quiz-locked-msg">Regardez la vidéo à 90% minimum pour débloquer le quiz.</p>
            </div>
        `;
    }

    return safeHtml`
        <div class="step-quiz quiz-ready">
            <div class="quiz-header">
                <h3>🎯 ${quizName}</h3>
                <span class="quiz-badge">✅ Débloqué</span>
            </div>
            <div class="quiz-warning">
                <div class="warning-icon">⚠️</div>
                <div class="warning-text">
                    <strong>Attention - Une seule tentative</strong>
                    <p>Vous n'aurez qu'<strong>une seule tentative</strong> pour ce quiz.</p>
                </div>
            </div>
            <button class="quiz-start-btn" data-testid="quiz-start-btn" onclick="${raw(onclickHandler)}">
                Commencer le quiz
            </button>
            <div id="quiz-container-${cls.id}" class="quiz-container" style="display: none;"></div>
        </div>
    `;
};
