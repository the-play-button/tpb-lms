/**
 * POST /api/courses/:id/enroll
 * Enroll in a course
 */

import { jsonResponse, MAX_ACTIVE_ENROLLMENTS, generateId, getUserId } from './_shared.js';

export async function enrollInCourse(request, env, userContext, courseId) {
    const userId = getUserId(userContext);

    if (!userId) {
        return jsonResponse({ error: 'User not authenticated' }, 401, request);
    }

    // Check if course exists
    const course = await env.DB.prepare(
        `SELECT id, name, is_active FROM lms_course WHERE id = ?`
    ).bind(courseId).first();

    if (!course || !course.is_active) {
        return jsonResponse({ error: 'Course not found or inactive' }, 404, request);
    }

    // Check if already enrolled
    const existing = await env.DB.prepare(
        `SELECT id, status FROM lms_enrollment WHERE user_id = ? AND course_id = ?`
    ).bind(userId, courseId).first();

    if (existing) {
        if (existing.status === 'active') {
            return jsonResponse({ error: 'Already enrolled in this course' }, 409, request);
        }

        // Re-enroll (previously completed or abandoned)
        // Check active limit first
        const activeCount = await env.DB.prepare(
            `SELECT COUNT(*) as count FROM lms_enrollment WHERE user_id = ? AND status = 'active'`
        ).bind(userId).first();

        if (activeCount.count >= MAX_ACTIVE_ENROLLMENTS) {
            return jsonResponse({
                error: 'Maximum active enrollments reached',
                max_active: MAX_ACTIVE_ENROLLMENTS,
                active_count: activeCount.count,
            }, 403, request);
        }

        // Reactivate enrollment
        await env.DB.prepare(`
            UPDATE lms_enrollment
            SET status = 'active',
                started_at = datetime('now'),
                completed_at = NULL,
                abandoned_at = NULL,
                last_activity_at = datetime('now'),
                updated_at = datetime('now')
            WHERE id = ?
        `).bind(existing.id).run();

        return jsonResponse({
            message: 'Re-enrolled in course',
            enrollment_id: existing.id,
            course_id: courseId,
            course_name: course.name,
        }, 200, request);
    }

    // Check active enrollment limit
    const activeCount = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM lms_enrollment WHERE user_id = ? AND status = 'active'`
    ).bind(userId).first();

    if (activeCount.count >= MAX_ACTIVE_ENROLLMENTS) {
        return jsonResponse({
            error: 'Maximum active enrollments reached',
            max_active: MAX_ACTIVE_ENROLLMENTS,
            active_count: activeCount.count,
            suggestion: 'Complete or abandon an existing course to enroll in a new one',
        }, 403, request);
    }

    // Create new enrollment
    const enrollmentId = generateId();

    await env.DB.prepare(`
        INSERT INTO lms_enrollment (id, user_id, course_id, status, started_at, created_at, updated_at)
        VALUES (?, ?, ?, 'active', datetime('now'), datetime('now'), datetime('now'))
    `).bind(enrollmentId, userId, courseId).run();

    return jsonResponse({
        message: 'Enrolled in course',
        enrollment_id: enrollmentId,
        course_id: courseId,
        course_name: course.name,
        active_enrollments: activeCount.count + 1,
        max_active: MAX_ACTIVE_ENROLLMENTS,
    }, 201, request);
}
