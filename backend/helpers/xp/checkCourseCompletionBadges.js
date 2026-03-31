/**
 * Check and award course completion badges
 * Called when course_completed becomes true
 */

import { awardBadge } from './_shared.js';

export const checkCourseCompletionBadges = async (db, userId, courseId) => {
    const badges = [];

    // Award "course_complete" badge for completing any course
    const completeBadge = await awardBadge(db, userId, 'course_complete', courseId);
    if (completeBadge) badges.push(completeBadge);

    // Count total completed courses for "course_5" badge
    const completedCourses = await db.prepare(`
        SELECT COUNT(DISTINCT course_id) as count
        FROM lms_signal
        WHERE user_id = ? AND type = 'COURSE_COMPLETED'
    `).bind(userId).first();

    const courseCount = (completedCourses?.count || 0) + 1; // +1 for current completion

    if (courseCount >= 5) {
        const expertBadge = await awardBadge(db, userId, 'course_5', courseId);
        if (expertBadge) badges.push(expertBadge);
    }

    return badges;
};
