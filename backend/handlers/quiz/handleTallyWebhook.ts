/**
 * Handle Tally webhook (from request or pre-read body)
 */

import { jsonResponse, extractFieldsFromPayload, calculateScore, processQuizSubmission } from './_shared.js';
import { findQuizClassByTallyFormId } from '../../services/quiz/QuizService.js';
import type { Env } from "../../types/Env.js";

const processTallyPayload = async (payload, env: Env, request: Request) => {
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

export const handleTallyWebhookWithBody = (bodyText, env: Env, request: Request) =>
    processTallyPayload(JSON.parse(bodyText), env, request);

export const handleTallyWebhook = async (request: Request, env: Env) =>
    processTallyPayload(await request.json(), env, request);
