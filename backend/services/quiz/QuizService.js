/**
 * QuizService — quiz-class lookup + submission orchestration.
 *
 * The heavy lifting (scoring, projections, badges) lives in
 * backend/handlers/quiz/_shared.js (kept as private helper because it's already
 * a service-shaped module). This wrapper exposes the public service API and
 * keeps DB access out of the thin handlers.
 */

import { calculateScore, processQuizSubmission } from '../../handlers/quiz/_shared.js';

const findQuizClassByTallyFormId = (env, tallyFormId) =>
    env.DB.prepare(`
        SELECT lc.* FROM lms_class lc, json_each(lc.media_json) je
        WHERE json_extract(je.value, '$.tally_form_id') = ?
    `).bind(tallyFormId).first();

export const submitQuizFromUser = async (env, request, body) => {
    const quizClass = await findQuizClassByTallyFormId(env, body.quizId);
    const { score, maxScore } = calculateScore(body.answers || [], quizClass);
    const enriched = {
        ...body,
        score,
        maxScore,
        classId: body.classId || quizClass?.id,
        courseId: body.courseId || quizClass?.course_id,
    };
    return processQuizSubmission(enriched, env, request, quizClass);
};

export { findQuizClassByTallyFormId };
