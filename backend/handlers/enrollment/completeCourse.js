// entropy-positional-args-excess-ok: CF Worker handler utility — (request, env, ctx, param) calling convention
// entropy-handler-service-pattern-ok: simple handler, business logic is minimal
/**
 * POST /api/courses/:id/complete
 * Mark a course as completed (called internally when all steps are done)
 */

import { jsonResponse, getUserId } from './_shared.js';

export const completeCourse = async (request, env, userContext, courseId) => {
    const userId = getUserId(userContext);

    if (!userId) {
        return jsonResponse({ error: 'User not authenticated' }, 401, request);
    }

    const enrollment = await env.DB.prepare(
        `SELECT id, status FROM lms_enrollment WHERE user_id = ? AND course_id = ?`
    ).bind(userId, courseId).first();

    if (!enrollment) {
        return jsonResponse({ error: 'No enrollment found for this course' }, 404, request);
    }

    if (enrollment.status === 'completed') {
        return jsonResponse({ message: 'Course already completed' }, 200, request);
    }

    await env.DB.prepare(`
        UPDATE lms_enrollment
        SET status = 'completed',
            completed_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
    `).bind(enrollment.id).run();

    return jsonResponse({
        message: 'Course completed',
        enrollment_id: enrollment.id,
        course_id: courseId,
    }, 200, request);
};
