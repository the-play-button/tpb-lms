// entropy-handler-service-pattern-ok: shared quiz logic, co-located with handlers by design
// entropy-business-logic-ok: already in backend
// entropy-multiple-exports-ok: cohesive module exports
// entropy-business-logic-in-frontend-ok: intentional frontend logic
/**
 * Shared helpers for quiz handlers
 */

import { jsonResponse } from '../../cors.js';
import { recordQuizEvent, checkQuizBadges, checkStreakBadges } from '../../helpers/xp/index.js';
import { applyProjections } from '../../projections/engine.js';
import { generateEventId } from '../../helpers/events.js';
import { logger } from '../../utils/log.js';

export const log = logger('quiz');
export const XP_QUIZ_PASS = 100;

export { jsonResponse, recordQuizEvent, checkQuizBadges, checkStreakBadges, applyProjections, generateEventId };

/**
 * Get pass threshold from quiz class media_json
 */
export function getPassThreshold(quizClass) {
    if (!quizClass?.media_json) {
        return 80;
    }
    const media = JSON.parse(quizClass.media_json);
    const quizMedia = media.find(m => m.type === 'QUIZ' || m.type === 'WEB');
    return quizMedia?.pass_threshold || 80;
}

/**
 * Build list of wrong answers for corrections modal
 */
export function buildWrongAnswersList(answers, correctAnswers) {
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
 * Extract user/course/answers from Tally fields
 */
export function extractFieldsFromPayload(fields) {
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
export function calculateScore(answers, quizClass) {
    if (!quizClass) {
        throw new Error('calculateScore: quizClass is null — quiz lookup failed');
    }
    if (!quizClass.raw_json) {
        throw new Error(`calculateScore: raw_json missing on class ${quizClass.id}`);
    }

    const config = JSON.parse(quizClass.raw_json);
    const correctAnswers = config.correct_answers;
    if (!correctAnswers || Object.keys(correctAnswers).length === 0) {
        throw new Error(`calculateScore: no correct_answers in class ${quizClass.id}`);
    }

    const maxScore = Object.keys(correctAnswers).length;
    let score = 0;

    if (Array.isArray(answers)) {
        for (const field of answers) {
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
        for (const [key, correct] of Object.entries(correctAnswers)) {
            if (answers[key] === correct) score++;
        }
    }

    return { score, maxScore };
}

/**
 * Store quiz event in lms_event and run projections
 */
export async function storeQuizEvent(
    env,
    { userId, quizId, courseId, classId, score, maxScore, percentage, passed } = {}
) {
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
export async function handleQuizBadges(db, userId, isPerfect) {
    let badge = await checkQuizBadges(db, userId, isPerfect);
    if (!badge) badge = await checkStreakBadges(db, userId);
    return badge;
}

/**
 * Process quiz submission (main logic)
 */
export async function processQuizSubmission(data, env, request, quizClass = null) {
    const { userId, quizId, courseId, classId, score, maxScore, answers } = data;

    if (!userId || !quizId || score === undefined || !maxScore) {
        return jsonResponse({ error: 'Missing required fields' }, 400, request);
    }

    const passThreshold = getPassThreshold(quizClass);
    const percentage = Math.round((score / maxScore) * 100);
    const passed = percentage >= passThreshold;
    const isPerfect = percentage === 100;

    log.info('Quiz submission', { userId, quizId, score, maxScore, percentage, passThreshold, passed });

    await recordQuizEvent(env.DB, userId, quizId, courseId, classId, score, maxScore, passed, answers);

    if (courseId && classId) {
        try {
            await storeQuizEvent(env, { userId, quizId, courseId, classId, score, maxScore, percentage, passed });
        } catch (e) {
            log.error('Failed to store lms_event or run projection', { error: e });
        }
    }

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

        return jsonResponse({
            success: true,
            passed: false,
            percentage,
            score,
            maxScore,
            mustRewatch: true
        }, 200, request);
    }

    let xpAwarded = 0;
    let badgeEarned = null;
    let wrongAnswers = null;

    if (passed) {
        xpAwarded = XP_QUIZ_PASS;
        badgeEarned = await handleQuizBadges(env.DB, userId, isPerfect);

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
        wrongAnswers,
        signalsGenerated: true
    }, 200, request);
}
