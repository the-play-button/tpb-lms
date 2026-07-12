/**
 * Handle Tally webhook (from request or pre-read body)
 */

import { jsonResponse, extractFieldsFromPayload, calculateScore, processQuizSubmission } from './_shared.js';
import { findQuizClassByTallyFormId } from '../../services/quiz/QuizService.js';
import type { Env } from "../../types/Env.js";

interface TallyWebhookPayload {
    eventType?: string;
    data?: {
        fields?: Array<{ key?: string; label?: string; title?: string; value?: unknown; answer?: { value?: unknown } }>;
        formId?: string;
    };
}

const processTallyPayload = async (payload: TallyWebhookPayload, env: Env, request: Request) => {
    if (payload.eventType !== 'FORM_RESPONSE') {
        return jsonResponse({ ignored: true, reason: 'Not a form response' }, 200, request);
    }

    const { userId, courseId, answers } = extractFieldsFromPayload(payload.data?.fields || []);
    const formId = payload.data?.formId ?? '';
    if (!userId) return jsonResponse({ error: 'Missing user_id in submission' }, 400, request);

    const quizClass = await findQuizClassByTallyFormId(env, formId);
    const { score, maxScore } = calculateScore(answers, quizClass);

    return processQuizSubmission({
        userId: userId as string,
        quizId: formId,
        courseId: (courseId as string) || (quizClass?.course_id as string) || '',
        classId: (quizClass?.id as string) ?? '',
        score,
        maxScore,
        answers,
    }, env, request, quizClass);
};

export const handleTallyWebhookWithBody = (bodyText: string, env: Env, request: Request) =>
    processTallyPayload(JSON.parse(bodyText) as TallyWebhookPayload, env, request);

export const handleTallyWebhook = async (request: Request, env: Env) =>
    processTallyPayload(await request.json() as TallyWebhookPayload, env, request);
