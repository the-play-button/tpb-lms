// entropy-handler-service-pattern-ok: simple handler, business logic is minimal
/**
 * GET /api/enrollments
 * List all enrollments for the current user
 */

import { jsonResponse, MAX_ACTIVE_ENROLLMENTS, getUserId } from './_shared.js';

export async function listEnrollments(request, env, userContext) {
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

    const enrollments = (result.results || []).map(e => ({
        id: e.id,
        course_id: e.course_id,
        course_name: e.course_name,
        course_description: e.course_description,
        status: e.status,
        current_class_id: e.current_class_id,
        completed_classes_count: e.completed_classes_count || 0,
        total_classes: e.total_classes || 0,
        progress_percent: e.total_classes > 0
            ? Math.round((e.completed_classes_count / e.total_classes) * 100)
            : 0,
        started_at: e.started_at,
        completed_at: e.completed_at,
        abandoned_at: e.abandoned_at,
        last_activity_at: e.last_activity_at,
    }));

    // Count by status for summary
    const activeCount = enrollments.filter(e => e.status === 'active').length; // entropy-naming-convention-ok: scalar count value

    return jsonResponse({
        enrollments,
        summary: {
            total: enrollments.length,
            active: activeCount,
            max_active: MAX_ACTIVE_ENROLLMENTS,
            can_enroll: activeCount < MAX_ACTIVE_ENROLLMENTS,
        }
    }, 200, request);
}
