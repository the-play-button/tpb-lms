// entropy-positional-args-excess-ok: handler exports (handleQuizSubmission) use CF Worker positional convention (request, env, ctx)
// entropy-handler-service-pattern-ok: handleQuizSubmission handler delegates to backend, minimal orchestration logic
// entropy-business-logic-ok: handleQuizSubmission logic already exists in backend, frontend mirrors it
// entropy-business-logic-in-frontend-ok: handleQuizSubmission contains intentional client-side presentation logic
/**
 * Handle quiz submission from HTTP request
 */

import { calculateScore, processQuizSubmission, log } from './_shared.js';

export const handleQuizSubmission = async (request, env, userContext) => {
    const body = await request.json();
    body.userId = userContext.contact.id;

    const quizClass = await env.DB.prepare(`
        SELECT lc.* FROM lms_class lc, json_each(lc.media_json) je
        WHERE json_extract(je.value, '$.tally_form_id') = ?
    `).bind(body.quizId).first();

    const { score, maxScore } = calculateScore(body.answers || [], quizClass);
    body.score = score;
    body.maxScore = maxScore;
    body.classId = body.classId || quizClass?.id;
    body.courseId = body.courseId || quizClass?.course_id;

    return await processQuizSubmission(body, env, request, quizClass);
};
