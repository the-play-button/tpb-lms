/**
 * Quiz and Tally Webhook Handlers
 * 
 * Records quiz submissions in crm_event (Unified.to aligned)
 * AND in lms_event for the projection engine to generate signals.
 * 
 * Refactored for reduced complexity.
 */

import { jsonResponse } from '../cors.js';
import { recordQuizEvent, checkQuizBadges, checkStreakBadges } from '../helpers/xp.js';
import { applyProjections } from '../projections/engine.js';
import { generateEventId } from '../helpers/events.js';
import { logger } from '../utils/log.js';

const log = logger('quiz');
const XP_QUIZ_PASS = 100;

/**
 * Get pass threshold from quiz class media_json
 * @returns {number} - Threshold percentage (default 80)
 */
function getPassThreshold(quizClass) {
    try {
        const media = JSON.parse(quizClass?.media_json || '[]');
        const quizMedia = media.find(m => m.type === 'QUIZ');
        return quizMedia?.pass_threshold || 80;
    } catch {
        return 80;
    }
}

/**
 * Build list of wrong answers for corrections modal
 * @returns {Array|null} - Array of {question, yourAnswer, correctAnswer} or null
 */
function buildWrongAnswersList(answers, correctAnswers) {
    const wrong = [];
    if (!Array.isArray(answers)) return null;
    
    for (const field of answers) {
        const questionText = field.title || field.label;
        const userAnswer = field.answer?.value || field.value;
        const correct = correctAnswers[questionText];
        
        if (correct && userAnswer !== correct) {
            wrong.push({
                question: questionText,
                yourAnswer: userAnswer,
                correctAnswer: correct
            });
        }
    }
    return wrong.length > 0 ? wrong : null;
}

/**
 * Verify Tally webhook signature (HMAC-SHA256)
 */
export async function verifyTallySignature(request, signingSecret) {
    const signature = request.headers.get('Tally-Signature');
    const body = await request.text();
    
    if (!signature) return { valid: false, body, noSignature: true };
    
    try {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw', encoder.encode(signingSecret),
            { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
        );
        const signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
        const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(body));
        return { valid, body, noSignature: false };
    } catch (error) {
        log.error('Signature verification error', { error });
        return { valid: false, body, noSignature: false, error: error.message };
    }
}

/**
 * Handle Tally webhook with body already read
 */
export async function handleTallyWebhookWithBody(bodyText, env, request) {
    const payload = JSON.parse(bodyText);
    return await processTallyPayload(payload, env, request);
}

/**
 * Handle Tally webhook from request (direct JSON parsing)
 */
export async function handleTallyWebhook(request, env) {
    const payload = await request.json();
    return await processTallyPayload(payload, env, request);
}

// ============================================
// Helper functions (reduce complexity)
// ============================================

/**
 * Extract user/course/answers from Tally fields
 */
function extractFieldsFromPayload(fields) {
    let userId = null;
    let courseId = null;
    const answers = {};

    for (const field of fields) {
        const key = field.key || '';
        const label = (field.label || '').toLowerCase();
        const value = field.value;

        if (key.includes('user_id') || label.includes('user') || label.includes('email')) {
            userId = value;
        } else if (key.includes('course_id') || label.includes('course')) {
            courseId = value;
        } else if (value !== null && value !== undefined) {
            answers[key] = value;
        }
    }
    return { userId, courseId, answers };
}

/**
 * Calculate quiz score from answers and config
 */
function calculateScore(answers, quizClass) {
    // Handle both formats: array from Tally [{key, label, value}] or object {key: value}
    if (!quizClass?.raw_json) {
        return { score: 0, maxScore: 1 }; // Fallback sécurisé
    }
    
    try {
        const config = JSON.parse(quizClass.raw_json);
        const correctAnswers = config.correct_answers || {};
        const maxScore = Object.keys(correctAnswers).length;
        
        if (maxScore === 0) {
            return { score: 0, maxScore: 1 }; // Pas de bonnes réponses configurées
        }
        
        let score = 0;
        
        // Handle Tally format: array of {id, title, type, answer: {value, raw}}
        if (Array.isArray(answers)) {
            for (const field of answers) {
                // Tally uses 'title' not 'label', and value is in 'answer.value'
                const questionText = field.title || field.label;
                const userAnswer = field.answer?.value || field.value;
                const correct = correctAnswers[questionText];
                
                log.info('Checking answer', { 
                    questionText, 
                    userAnswer, 
                    expected: correct,
                    match: userAnswer === correct 
                });
                
                if (correct && userAnswer === correct) {
                    score++;
                }
            }
        } else {
            // Handle legacy format: object {key: value}
            for (const [key, correct] of Object.entries(correctAnswers)) {
                if (answers[key] === correct) score++;
            }
        }
        
        return { score, maxScore };
    } catch (e) {
        log.warn('Quiz config parse error', { error: e.message });
        return { score: 0, maxScore: 1 };
    }
}

/**
 * Store quiz event in lms_event and run projections
 */
async function storeQuizEvent(env, { userId, quizId, courseId, classId, score, maxScore, percentage, passed }) {
    const eventId = generateEventId();
    const now = new Date().toISOString();
    const payload = { quiz_id: quizId, score, max_score: maxScore, percentage, passed };
    
    await env.DB.prepare(`
        INSERT INTO lms_event (id, type, user_id, course_id, class_id, occurred_at, payload_json)
        VALUES (?, 'QUIZ_SUBMIT', ?, ?, ?, ?, ?)
    `).bind(eventId, userId, courseId, classId, now, JSON.stringify(payload)).run();
    
    log.info('QUIZ_SUBMIT event stored', { eventId });
    
    await applyProjections(env.DB, {
        id: eventId, type: 'QUIZ_SUBMIT', user_id: userId,
        course_id: courseId, class_id: classId, payload_json: JSON.stringify(payload)
    });
    
    log.info('Projection applied for quiz');
    return eventId;
}

/**
 * Handle badges for passed quiz
 */
async function handleQuizBadges(db, userId, isPerfect) {
    let badge = await checkQuizBadges(db, userId, isPerfect);
    if (!badge) badge = await checkStreakBadges(db, userId);
    return badge;
}

// ============================================
// Main handlers
// ============================================

/**
 * Process Tally webhook payload
 */
async function processTallyPayload(payload, env, request) {
    if (payload.eventType !== 'FORM_RESPONSE') {
        return jsonResponse({ ignored: true, reason: 'Not a form response' }, 200, request);
    }

    const { userId, courseId, answers } = extractFieldsFromPayload(payload.data?.fields || []);
    const formId = payload.data?.formId;

    if (!userId) {
        return jsonResponse({ error: 'Missing user_id in submission' }, 400, request);
    }

    const quizClass = await env.DB.prepare(`
        SELECT * FROM lms_class WHERE json_extract(media_json, '$[1].tally_form_id') = ?
    `).bind(formId).first();

    const { score, maxScore } = calculateScore(answers, quizClass);

    return await processQuizSubmission({
        userId, quizId: formId, 
        courseId: courseId || quizClass?.course_id,
        classId: quizClass?.id,
        score, maxScore, answers
    }, env, request, quizClass);
}

/**
 * Handle quiz submission from HTTP request
 */
export async function handleQuizSubmission(request, env, userContext) {
    const body = await request.json();
    body.userId = userContext.contact.id;
    
    // Récupérer la classe pour avoir les correct_answers et pass_threshold
    const quizClass = await env.DB.prepare(`
        SELECT * FROM lms_class 
        WHERE json_extract(media_json, '$[1].tally_form_id') = ?
    `).bind(body.quizId).first();
    
    // Recalculer le score côté serveur
    const { score, maxScore } = calculateScore(body.answers || [], quizClass);
    body.score = score;
    body.maxScore = maxScore;
    body.classId = body.classId || quizClass?.id;
    body.courseId = body.courseId || quizClass?.course_id;
    
    return await processQuizSubmission(body, env, request, quizClass);
}

/**
 * Process quiz submission (main logic)
 */
async function processQuizSubmission(data, env, request, quizClass = null) {
    const { userId, quizId, courseId, classId, score, maxScore, answers } = data;

    if (!userId || !quizId || score === undefined || !maxScore) {
        return jsonResponse({ error: 'Missing required fields' }, 400, request);
    }

    // Use configurable threshold from quiz config
    const passThreshold = getPassThreshold(quizClass);
    const percentage = Math.round((score / maxScore) * 100);
    const passed = percentage >= passThreshold;
    const isPerfect = percentage === 100;

    log.info('Quiz submission', { userId, quizId, score, maxScore, percentage, passThreshold, passed });

    // Record quiz event (for tracking)
    await recordQuizEvent(env.DB, userId, quizId, courseId, classId, score, maxScore, passed, answers);

    // Record in lms_event + run projections
    if (courseId && classId) {
        try {
            await storeQuizEvent(env, { userId, quizId, courseId, classId, score, maxScore, percentage, passed });
        } catch (e) {
            log.error('Failed to store lms_event or run projection', { error: e });
        }
    }

    // ECHEC: Reset video progress pour forcer le re-visionnage depuis le début
    if (!passed && courseId && classId) {
        try {
            await env.DB.prepare(`
                UPDATE v_user_progress 
                SET video_completed = 0, 
                    video_completed_at = NULL,
                    video_max_position_sec = 0
                WHERE user_id = ? AND class_id = ?
            `).bind(userId, classId).run();
            log.info('Reset video progress for retry (position reset to 0)', { userId, classId });
        } catch (e) {
            log.error('Failed to reset video progress', { error: e });
        }

        // Retourner sans corrections - l'utilisateur doit recommencer
        return jsonResponse({ 
            success: true, 
            passed: false, 
            percentage, 
            score, 
            maxScore,
            mustRewatch: true  // Signal au frontend d'afficher le message
        }, 200, request);
    }

    // REUSSITE: Handle XP, badges, et corrections si pas parfait
    let xpAwarded = 0;
    let badgeEarned = null;
    let wrongAnswers = null;
    
    if (passed) {
        xpAwarded = XP_QUIZ_PASS;
        badgeEarned = await handleQuizBadges(env.DB, userId, isPerfect);
        
        // Construire la liste des erreurs si pas 100%
        if (!isPerfect && quizClass?.raw_json) {
            try {
                const config = JSON.parse(quizClass.raw_json);
                wrongAnswers = buildWrongAnswersList(answers, config.correct_answers || {});
            } catch (e) {
                log.warn('Failed to build wrong answers list', { error: e.message });
            }
        }
    }

    return jsonResponse({ 
        success: true, 
        passed: true, 
        percentage, 
        score, 
        maxScore,
        xpAwarded, 
        badgeEarned, 
        wrongAnswers,  // Liste des erreurs pour le modal de corrections
        signalsGenerated: true
    }, 200, request);
}
