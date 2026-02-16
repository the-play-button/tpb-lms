/**
 * Handle quiz submission from HTTP request
 */

import { calculateScore, processQuizSubmission, log } from './_shared.js';

export async function handleQuizSubmission(request, env, userContext) {
    const body = await request.json();
    body.userId = userContext.contact.id;

    const quizClass = await env.DB.prepare(`
        SELECT * FROM lms_class
        WHERE json_extract(media_json, '$[1].tally_form_id') = ?
    `).bind(body.quizId).first();

    const { score, maxScore } = calculateScore(body.answers || [], quizClass);
    body.score = score;
    body.maxScore = maxScore;
    body.classId = body.classId || quizClass?.id;
    body.courseId = body.courseId || quizClass?.course_id;

    return await processQuizSubmission(body, env, request, quizClass);
}
