/**
 * Handle Tally webhook (from request or pre-read body)
 */

import { jsonResponse, extractFieldsFromPayload, calculateScore, processQuizSubmission } from './_shared.js';
import { findQuizClassByTallyFormId } from '../../services/quiz/QuizService.js';

const processTallyPayload = async (payload, env, request) => {
    if (payload.eventType !== 'FORM_RESPONSE') {
        return jsonResponse({ ignored: true, reason: 'Not a form response' }, 200, request);
    }

    const { userId, courseId, answers } = extractFieldsFromPayload(payload.data?.fields || []);
    const formId = payload.data?.formId;
    if (!userId) return jsonResponse({ error: 'Missing user_id in submission' }, 400, request);

    const quizClass = await findQuizClassByTallyFormId(env, formId);
    const { score, maxScore } = calculateScore(answers, quizClass);

    return processQuizSubmission({
        userId,
        quizId: formId,
        courseId: courseId || quizClass?.course_id,
        classId: quizClass?.id,
        score,
        maxScore,
        answers,
    }, env, request, quizClass);
};

export const handleTallyWebhookWithBody = (bodyText, env, request) =>
    processTallyPayload(JSON.parse(bodyText), env, request);

export const handleTallyWebhook = async (request, env) =>
    processTallyPayload(await request.json(), env, request);
