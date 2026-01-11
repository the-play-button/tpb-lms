/**
 * Enrollment Handler
 * 
 * Manages user enrollments in courses with:
 * - Limit of 3 active enrollments per user
 * - Enroll, abandon, and completion tracking
 * - Enrollment history
 */

import { jsonResponse } from '../cors.js';

// Maximum number of active enrollments per user
const MAX_ACTIVE_ENROLLMENTS = 3;

/**
 * Generate a unique ID for enrollment
 */
function generateId() {
    return `enr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * GET /api/enrollments
 * List all enrollments for the current user
 */
export async function listEnrollments(request, env, userContext) {
    const userId = userContext.contact?.id || userContext.employee?.id;
    
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
    const activeCount = enrollments.filter(e => e.status === 'active').length;
    
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

/**
 * POST /api/courses/:id/enroll
 * Enroll in a course
 */
export async function enrollInCourse(request, env, userContext, courseId) {
    const userId = userContext.contact?.id || userContext.employee?.id;
    
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

/**
 * POST /api/courses/:id/abandon
 * Abandon a course enrollment
 */
export async function abandonCourse(request, env, userContext, courseId) {
    const userId = userContext.contact?.id || userContext.employee?.id;
    
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

/**
 * POST /api/courses/:id/complete
 * Mark a course as completed (called internally when all steps are done)
 */
export async function completeCourse(request, env, userContext, courseId) {
    const userId = userContext.contact?.id || userContext.employee?.id;
    
    if (!userId) {
        return jsonResponse({ error: 'User not authenticated' }, 401, request);
    }
    
    // Find active enrollment
    const enrollment = await env.DB.prepare(
        `SELECT id, status FROM lms_enrollment WHERE user_id = ? AND course_id = ?`
    ).bind(userId, courseId).first();
    
    if (!enrollment) {
        return jsonResponse({ error: 'No enrollment found for this course' }, 404, request);
    }
    
    if (enrollment.status === 'completed') {
        return jsonResponse({ message: 'Course already completed' }, 200, request);
    }
    
    // Mark as completed
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
}

/**
 * PATCH /api/enrollments/:id/progress
 * Update enrollment progress (called when navigating to a new step)
 */
export async function updateProgress(request, env, userContext, enrollmentId) {
    const userId = userContext.contact?.id || userContext.employee?.id;
    
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

/**
 * GET /api/courses/:id/enrollment
 * Get enrollment status for a specific course
 */
export async function getEnrollmentStatus(request, env, userContext, courseId) {
    const userId = userContext.contact?.id || userContext.employee?.id;
    
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
        // Check if user can enroll
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
}
