/**
 * Record course completion signal
 */

export const recordCourseCompletion = async (db, userId, courseId) => {
    const now = new Date().toISOString();
    const id = `sig_course_complete_${courseId}_${userId}_${Date.now()}`;

    const existing = await db.prepare(`
        SELECT 1 FROM lms_signal WHERE user_id = ? AND course_id = ? AND type = 'COURSE_COMPLETED'
    `).bind(userId, courseId).first();

    if (existing) return false;

    await db.prepare(`
        INSERT INTO lms_signal (id, user_id, type, course_id, class_id, data_json, created_at)
        VALUES (?, ?, 'COURSE_COMPLETED', ?, 'final', '{}', ?)
    `).bind(id, userId, courseId, now).run();

    return true;
};
