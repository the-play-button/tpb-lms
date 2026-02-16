// entropy-handler-service-pattern-ok: simple handler, business logic is minimal
/**
 * PATCH /api/enrollments/:id/progress
 * Update enrollment progress (called when navigating to a new step)
 */

import { jsonResponse, getUserId } from './_shared.js';

export async function updateProgress(request, env, userContext, enrollmentId) {
    const userId = getUserId(userContext);

    if (!userId) {
        return jsonResponse({ error: 'User not authenticated' }, 401, request);
    }

    // Verify enrollment belongs to user
    const enrollment = await env.DB.prepare(
        `SELECT id, course_id, status FROM lms_enrollment WHERE id = ? AND user_id = ?`
    ).bind(enrollmentId, userId).first();

    if (!enrollment) {
        return jsonResponse({ error: 'Enrollment not found' }, 404, request);
    }

    if (enrollment.status !== 'active') {
        return jsonResponse({ error: 'Cannot update progress for non-active enrollment' }, 400, request);
    }

    // Parse request body
    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON' }, 400, request);
    }

    const { current_class_id, completed_classes_count } = body;

    // Update progress
    const updates = ['last_activity_at = datetime(\'now\')', 'updated_at = datetime(\'now\')'];
    const params = [];

    if (current_class_id !== undefined) {
        updates.push('current_class_id = ?');
        params.push(current_class_id);
    }

    if (completed_classes_count !== undefined) {
        updates.push('completed_classes_count = ?');
        params.push(completed_classes_count);
    }

    params.push(enrollmentId);

    await env.DB.prepare(`
        UPDATE lms_enrollment SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();

    return jsonResponse({ message: 'Progress updated' }, 200, request);
}
