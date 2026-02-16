/**
 * POST /api/courses/:id/abandon
 * Abandon a course enrollment
 */

import { jsonResponse, MAX_ACTIVE_ENROLLMENTS, getUserId } from './_shared.js';

export async function abandonCourse(request, env, userContext, courseId) {
    const userId = getUserId(userContext);

    if (!userId) {
        return jsonResponse({ error: 'User not authenticated' }, 401, request);
    }

    // Find active enrollment
    const enrollment = await env.DB.prepare(
        `SELECT id, status FROM lms_enrollment WHERE user_id = ? AND course_id = ? AND status = 'active'`
    ).bind(userId, courseId).first();

    if (!enrollment) {
        return jsonResponse({ error: 'No active enrollment found for this course' }, 404, request);
    }

    // Mark as abandoned
    await env.DB.prepare(`
        UPDATE lms_enrollment
        SET status = 'abandoned',
            abandoned_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
    `).bind(enrollment.id).run();

    // Get updated active count
    const activeCount = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM lms_enrollment WHERE user_id = ? AND status = 'active'`
    ).bind(userId).first();

    return jsonResponse({
        message: 'Course abandoned',
        enrollment_id: enrollment.id,
        course_id: courseId,
        active_enrollments: activeCount.count,
        max_active: MAX_ACTIVE_ENROLLMENTS,
    }, 200, request);
}
