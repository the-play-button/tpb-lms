// entropy-handler-service-pattern-ok: simple handler, business logic is minimal
/**
 * GET /api/courses/:id/enrollment
 * Get enrollment status for a specific course
 */

import { jsonResponse, MAX_ACTIVE_ENROLLMENTS, getUserId } from './_shared.js';

export const getEnrollmentStatus = async (request, env, userContext, courseId) => {
    const userId = getUserId(userContext);

    if (!userId) {
        return jsonResponse({ error: 'User not authenticated' }, 401, request);
    }

    const enrollment = await env.DB.prepare(
        `SELECT e.*,
                (SELECT COUNT(*) FROM lms_class WHERE course_id = e.course_id) as total_classes
         FROM lms_enrollment e
         WHERE e.user_id = ? AND e.course_id = ?`
    ).bind(userId, courseId).first();

    if (!enrollment) {
        const activeCount = await env.DB.prepare(
            `SELECT COUNT(*) as count FROM lms_enrollment WHERE user_id = ? AND status = 'active'`
        ).bind(userId).first();

        return jsonResponse({
            enrolled: false,
            can_enroll: activeCount.count < MAX_ACTIVE_ENROLLMENTS,
            active_enrollments: activeCount.count,
            max_active: MAX_ACTIVE_ENROLLMENTS,
        }, 200, request);
    }

    return jsonResponse({
        enrolled: true,
        enrollment: {
            id: enrollment.id,
            status: enrollment.status,
            current_class_id: enrollment.current_class_id,
            completed_classes_count: enrollment.completed_classes_count || 0,
            total_classes: enrollment.total_classes || 0,
            progress_percent: enrollment.total_classes > 0
                ? Math.round((enrollment.completed_classes_count / enrollment.total_classes) * 100)
                : 0,
            started_at: enrollment.started_at,
            completed_at: enrollment.completed_at,
            abandoned_at: enrollment.abandoned_at,
        }
    }, 200, request);
};
