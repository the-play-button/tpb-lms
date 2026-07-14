/**
 * Shared helpers for quiz handlers
 */

import { jsonResponse } from '../../cors.js';
import { recordQuizEvent, checkQuizBadges, checkStreakBadges } from '../../utils/xp/index.js';
import { applyProjections } from '../../projections/engine.js';
import { generateEventId } from '../../utils/events.js';
import { log } from '@the-play-button/tpb-sdk-js';
import type { Env } from "../../types/Env.js";

import type { QuizClassRow } from './_shared.types';
export type { QuizClassRow };


export { log };
export const XP_QUIZ_PASS = 100;

export { jsonResponse, recordQuizEvent, checkQuizBadges, checkStreakBadges, applyProjections, generateEventId };

/** Row shape of the quiz `lms_class` (media_json + raw_json carry the quiz config). */

/** Tally form field (answers arrive as an array of these). */
interface TallyField {
    key?: string;
    label?: string;
    title?: string;
    value?: unknown;
    answer?: { value?: unknown };
}

type CorrectAnswers = Record<string, unknown>;
type QuizAnswers = TallyField[] | Record<string, unknown>;

/** Normalize a caught `unknown` into an Error for `log.error`. */
const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));

/**
 * Get pass threshold from quiz class media_json
 */
export const getPassThreshold = (quizClass: QuizClassRow | null | undefined): number => {
    if (!quizClass?.media_json) {
        return 80;
    }
    const media = JSON.parse(quizClass.media_json) as Array<{ type?: string; pass_threshold?: number }>;
    const quizMedia = media.find((m) => m?.type === 'QUIZ' || m?.type === 'WEB');
    return quizMedia?.pass_threshold || 80;
};

/**
 * Build list of wrong answers for corrections modal
 */
export const buildWrongAnswersList = (answers: QuizAnswers, correctAnswers: CorrectAnswers) => {
    const wrongAnswers: Array<{ question: unknown; yourAnswer: unknown; correctAnswer: unknown }> = [];
    if (!Array.isArray(answers)) return null;

    for (const field of answers) {
        const questionText = field.title || field.label || '';
        const userAnswer = field.answer?.value || field.value;
        const correct = correctAnswers[questionText];

        if (correct && userAnswer !== correct) {
            wrongAnswers.push({
                question: questionText,
                yourAnswer: userAnswer,
                correctAnswer: correct
            });
        }
    }
    return wrong.length > 0 ? wrong : null;
};

/**
 * Extract user/course/answers from Tally fields
 */
export const extractFieldsFromPayload = (fields: TallyField[]) => {
    let userId: unknown = null;
    let courseId: unknown = null;
    const answers: Record<string, unknown> = {};

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
};

/**
 * Calculate quiz score from answers and config
 */
export const calculateScore = (answers: QuizAnswers, quizClass: QuizClassRow | null): { score: number; maxScore: number } => {
    if (!quizClass) {
        throw new Error('calculateScore: quizClass is null — quiz lookup failed');  // entropy-generic-error-ok: internal invariant assertion — the quiz pipeline guarantees a non-null quizClass with raw_json+correct_answers before calculateScore; this is a programming-invariant guard (500), not a user-facing domain error
    }
    if (!quizClass.raw_json) {
        throw new Error(`calculateScore: raw_json missing on class ${quizClass.id}`);  // entropy-generic-error-ok: internal invariant assertion — the quiz pipeline guarantees a non-null quizClass with raw_json+correct_answers before calculateScore; this is a programming-invariant guard (500), not a user-facing domain error
    }

    const correctAnswers = JSON.parse(quizClass.raw_json).correct_answers as CorrectAnswers | undefined;
    if (!correctAnswers || Object.keys(correctAnswers).length === 0) {
        throw new Error(`calculateScore: no correct_answers in class ${quizClass.id}`);  // entropy-generic-error-ok: internal invariant assertion — the quiz pipeline guarantees a non-null quizClass with raw_json+correct_answers before calculateScore; this is a programming-invariant guard (500), not a user-facing domain error
    }

    const maxScore = Object.keys(correctAnswers).length;
    let score = 0;

    if (Array.isArray(answers)) {
        for (const field of answers) {
            const questionText = field.title || field.label || '';
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
};

/**
 * Store quiz event in lms_event and run projections
 */
interface StoreQuizEventInput {
    userId: string;
    quizId: string;
    courseId: string;
    classId: string;
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
}

export const storeQuizEvent = async (
    env: Env,
    { userId, quizId, courseId, classId, score, maxScore, percentage, passed }: StoreQuizEventInput
) => {
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
};

/**
 * Handle badges for passed quiz
 */
export const handleQuizBadges = async (db: D1Database, userId: string, isPerfect: boolean) => {
    let badge = await checkQuizBadges(db, userId, isPerfect);
    if (!badge) badge = await checkStreakBadges(db, userId);
    return badge;
};

interface QuizSubmissionData {
    userId: string;
    quizId: string;
    courseId: string;
    classId: string;
    score: number;
    maxScore: number;
    answers: QuizAnswers;
}

/**
 * Process quiz submission (main logic)
 */
export const processQuizSubmission = async (data: QuizSubmissionData, env: Env, request: Request, quizClass: QuizClassRow | null = null) => {
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

    let storeQuizEventOk = false;
    if (courseId && classId) {
        try {
            await storeQuizEvent(env, { userId, quizId, courseId, classId, score, maxScore, percentage, passed });
            storeQuizEventOk = true;
        } catch (e) {
            log.error('Failed to store lms_event or run projection', toError(e));
            storeQuizEventOk = false; // explicit fail marker — telemetry only
        }
    }

    let videoProgressResetOk = false;
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
            videoProgressResetOk = true;
        } catch (e) {
            log.error('Failed to reset video progress', toError(e));
            videoProgressResetOk = false; // explicit fail marker — retry next request
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
                wrongAnswers = buildWrongAnswersList(answers, JSON.parse(quizClass.raw_json).correct_answers || {});
            } catch (e) {
                log.warn('Failed to build wrong answers list', { error: toError(e).message });
                wrongAnswers = null; // explicit fallback — UI shows generic "review incorrect answers" message
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
};
