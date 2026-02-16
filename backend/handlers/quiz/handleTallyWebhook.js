// entropy-handler-service-pattern-ok: simple handler, business logic is minimal
// entropy-business-logic-ok: already in backend
/**
 * Handle Tally webhook (from request or pre-read body)
 */

import { jsonResponse, extractFieldsFromPayload, calculateScore, processQuizSubmission, log } from './_shared.js';

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
