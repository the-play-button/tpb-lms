/**
 * EnrollmentService — DB access + business rules for course enrollment.
 *
 * Handlers in backend/handlers/enrollment/ stay thin : parse request,
 * delegate, format response. All DB queries and conditional flow live here.
 */

import { generateId, MAX_ACTIVE_ENROLLMENTS } from '../../handlers/enrollment/_shared.js';

export { MAX_ACTIVE_ENROLLMENTS };

const findCourseById = (env, courseId) =>
    env.DB.prepare('SELECT id, name, is_active FROM lms_course WHERE id = ?')
        .bind(courseId).first();

const findEnrollmentByCourse = (env, userId, courseId) =>
    env.DB.prepare('SELECT id, status FROM lms_enrollment WHERE user_id = ? AND course_id = ?')
        .bind(userId, courseId).first();

const findActiveEnrollmentByCourse = (env, userId, courseId) =>
    env.DB.prepare(
        "SELECT id, status FROM lms_enrollment WHERE user_id = ? AND course_id = ? AND status = 'active'"
    ).bind(userId, courseId).first();

const countActiveEnrollments = async (env, userId) => {
    const row = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM lms_enrollment WHERE user_id = ? AND status = 'active'"
    ).bind(userId).first();
    return row?.count ?? 0;
};

const reactivateEnrollment = (env, enrollmentId) =>
    env.DB.prepare(`
        UPDATE lms_enrollment
        SET status = 'active',
            started_at = datetime('now'),
            completed_at = NULL,
            abandoned_at = NULL,
            last_activity_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
    `).bind(enrollmentId).run();

const insertEnrollment = (env, enrollmentId, userId, courseId) =>
    env.DB.prepare(`
        INSERT INTO lms_enrollment (id, user_id, course_id, status, started_at, created_at, updated_at)
        VALUES (?, ?, ?, 'active', datetime('now'), datetime('now'), datetime('now'))
    `).bind(enrollmentId, userId, courseId).run();

const setEnrollmentStatus = (env, enrollmentId, status, timestampField) =>
    env.DB.prepare(`
        UPDATE lms_enrollment
        SET status = ?, ${timestampField} = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
    `).bind(status, enrollmentId).run();

const findEnrollmentForProgress = (env, userId, enrollmentId) =>
    env.DB.prepare('SELECT id, course_id, status FROM lms_enrollment WHERE id = ? AND user_id = ?')
        .bind(enrollmentId, userId).first();

const updateEnrollmentProgressFields = (env, enrollmentId, fields) => {
    const updates = ["last_activity_at = datetime('now')", "updated_at = datetime('now')"];
    const params = [];
    if (fields.current_class_id !== undefined) {
        updates.push('current_class_id = ?');
        params.push(fields.current_class_id);
    }
    if (fields.completed_classes_count !== undefined) {
        updates.push('completed_classes_count = ?');
        params.push(fields.completed_classes_count);
    }
    params.push(enrollmentId);
    return env.DB.prepare(`
        UPDATE lms_enrollment SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();
};

const findEnrollmentDetailsByCourse = (env, userId, courseId) =>
    env.DB.prepare(`
        SELECT e.*,
               (SELECT COUNT(*) FROM lms_class WHERE course_id = e.course_id AND node_kind = 'LESSON') as total_classes
        FROM lms_enrollment e
        WHERE e.user_id = ? AND e.course_id = ?
    `).bind(userId, courseId).first();

const queryUserEnrollments = (env, userId, status) => {
    let query = `
        SELECT e.*, c.name as course_name, c.description as course_description,
               (SELECT COUNT(*) FROM lms_class WHERE course_id = e.course_id AND node_kind = 'LESSON') as total_classes
        FROM lms_enrollment e
        JOIN lms_course c ON c.id = e.course_id
        WHERE e.user_id = ?
    `;
    const params = [userId];
    if (status) {
        query += ' AND e.status = ?';
        params.push(status);
    }
    query += ' ORDER BY e.updated_at DESC';
    return env.DB.prepare(query).bind(...params).all();
};

const projectEnrollment = (row) => ({
    id: row.id,
    course_id: row.course_id,
    course_name: row.course_name,
    course_description: row.course_description,
    status: row.status,
    current_class_id: row.current_class_id,
    completed_classes_count: row.completed_classes_count || 0,
    total_classes: row.total_classes || 0,
    progress_percent: row.total_classes > 0
        ? Math.round((row.completed_classes_count / row.total_classes) * 100)
        : 0,
    started_at: row.started_at,
    completed_at: row.completed_at,
    abandoned_at: row.abandoned_at,
    last_activity_at: row.last_activity_at,
});

// ============ PUBLIC SERVICE API ============

export const enrollUserInCourse = async (env, userId, courseId) => {
    const course = await findCourseById(env, courseId);
    if (!course || !course.is_active) {
        return { error: { status: 404, body: { error: 'Course not found or inactive' } } };
    }

    const existing = await findEnrollmentByCourse(env, userId, courseId);
    if (existing) {
        if (existing.status === 'active') {
            return { error: { status: 409, body: { error: 'Already enrolled in this course' } } };
        }
        const activeCount = await countActiveEnrollments(env, userId);
        if (activeCount >= MAX_ACTIVE_ENROLLMENTS) {
            return {
                error: {
                    status: 403,
                    body: {
                        error: 'Maximum active enrollments reached',
                        max_active: MAX_ACTIVE_ENROLLMENTS,
                        active_count: activeCount,
                    },
                },
            };
        }
        await reactivateEnrollment(env, existing.id);
        return {
            value: {
                status: 200,
                body: {
                    message: 'Re-enrolled in course',
                    enrollment_id: existing.id,
                    course_id: courseId,
                    course_name: course.name,
                },
            },
        };
    }

    const activeCount = await countActiveEnrollments(env, userId);
    if (activeCount >= MAX_ACTIVE_ENROLLMENTS) {
        return {
            error: {
                status: 403,
                body: {
                    error: 'Maximum active enrollments reached',
                    max_active: MAX_ACTIVE_ENROLLMENTS,
                    active_count: activeCount,
                    suggestion: 'Complete or abandon an existing course to enroll in a new one',
                },
            },
        };
    }

    const enrollmentId = generateId();
    await insertEnrollment(env, enrollmentId, userId, courseId);
    return {
        value: {
            status: 201,
            body: {
                message: 'Enrolled in course',
                enrollment_id: enrollmentId,
                course_id: courseId,
                course_name: course.name,
                active_enrollments: activeCount + 1,
                max_active: MAX_ACTIVE_ENROLLMENTS,
            },
        },
    };
};

export const abandonUserCourse = async (env, userId, courseId) => {
    const enrollment = await findActiveEnrollmentByCourse(env, userId, courseId);
    if (!enrollment) {
        return { error: { status: 404, body: { error: 'No active enrollment found for this course' } } };
    }
    await setEnrollmentStatus(env, enrollment.id, 'abandoned', 'abandoned_at');
    const activeCount = await countActiveEnrollments(env, userId);
    return {
        value: {
            status: 200,
            body: {
                message: 'Course abandoned',
                enrollment_id: enrollment.id,
                course_id: courseId,
                active_enrollments: activeCount,
                max_active: MAX_ACTIVE_ENROLLMENTS,
            },
        },
    };
};

export const completeUserCourse = async (env, userId, courseId) => {
    const enrollment = await findEnrollmentByCourse(env, userId, courseId);
    if (!enrollment) {
        return { error: { status: 404, body: { error: 'No enrollment found for this course' } } };
    }
    if (enrollment.status === 'completed') {
        return { value: { status: 200, body: { message: 'Course already completed' } } };
    }
    await setEnrollmentStatus(env, enrollment.id, 'completed', 'completed_at');
    return {
        value: {
            status: 200,
            body: {
                message: 'Course completed',
                enrollment_id: enrollment.id,
                course_id: courseId,
            },
        },
    };
};

export const updateUserEnrollmentProgress = async (env, userId, enrollmentId, fields) => {
    const enrollment = await findEnrollmentForProgress(env, userId, enrollmentId);
    if (!enrollment) {
        return { error: { status: 404, body: { error: 'Enrollment not found' } } };
    }
    if (enrollment.status !== 'active') {
        return { error: { status: 400, body: { error: 'Cannot update progress for non-active enrollment' } } };
    }
    await updateEnrollmentProgressFields(env, enrollmentId, fields);
    return { value: { status: 200, body: { message: 'Progress updated' } } };
};

export const getUserEnrollmentStatus = async (env, userId, courseId) => {
    const enrollment = await findEnrollmentDetailsByCourse(env, userId, courseId);
    if (!enrollment) {
        const activeCount = await countActiveEnrollments(env, userId);
        return {
            value: {
                status: 200,
                body: {
                    enrolled: false,
                    can_enroll: activeCount < MAX_ACTIVE_ENROLLMENTS,
                    active_enrollments: activeCount,
                    max_active: MAX_ACTIVE_ENROLLMENTS,
                },
            },
        };
    }
    return {
        value: {
            status: 200,
            body: {
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
                },
            },
        },
    };
};

export const listUserEnrollments = async (env, userId, status) => {
    const result = await queryUserEnrollments(env, userId, status);
    const enrollments = (result.results || []).map(projectEnrollment);
    const activeCount = enrollments.filter((e) => e.status === 'active').length;
    return {
        value: {
            status: 200,
            body: {
                enrollments,
                summary: {
                    total: enrollments.length,
                    active: activeCount,
                    max_active: MAX_ACTIVE_ENROLLMENTS,
                    can_enroll: activeCount < MAX_ACTIVE_ENROLLMENTS,
                },
            },
        },
    };
};
