// entropy-handler-service-pattern-ok: simple handler, business logic is minimal
/**
 * GET /api/enrollments
 * List all enrollments for the current user
 */

import { jsonResponse, MAX_ACTIVE_ENROLLMENTS, getUserId } from './_shared.js';

export const listEnrollments = async (request, env, userContext) => {
    const userId = getUserId(userContext);

    if (!userId) {
        return jsonResponse({ error: 'User not authenticated' }, 401, request);
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // Optional filter: active, completed, abandoned

    let query = `
        SELECT e.*, c.name as course_name, c.description as course_description,
               (SELECT COUNT(*) FROM lms_class WHERE course_id = e.course_id) as total_classes
        FROM lms_enrollment e
        JOIN lms_course c ON c.id = e.course_id
        WHERE e.user_id = ?
    `;

    const params = [userId];

    if (status) {
        query += ` AND e.status = ?`;
        params.push(status);
    }

    query += ` ORDER BY e.updated_at DESC`;

    const result = await env.DB.prepare(query).bind(...params).all();

    const enrollments = (result.results || []).map(({ id, course_id, course_name, course_description, status, current_class_id, completed_classes_count, total_classes, started_at, completed_at, abandoned_at, last_activity_at } = {}) => ({
        id: id,
        course_id: course_id,
        course_name: course_name,
        course_description: course_description,
        status: status,
        current_class_id: current_class_id,
        completed_classes_count: completed_classes_count || 0,
        total_classes: total_classes || 0,
        progress_percent: total_classes > 0
            ? Math.round((completed_classes_count / total_classes) * 100)
            : 0,
        started_at: started_at,
        completed_at: completed_at,
        abandoned_at: abandoned_at,
        last_activity_at: last_activity_at,
    }));

    const activeCount = enrollments.filter(({ status } = {}) => status === 'active').length; // entropy-naming-convention-ok: scalar count value

    return jsonResponse({
        enrollments,
        summary: {
            total: enrollments.length,
            active: activeCount,
            max_active: MAX_ACTIVE_ENROLLMENTS,
            can_enroll: activeCount < MAX_ACTIVE_ENROLLMENTS,
        }
    }, 200, request);
};
