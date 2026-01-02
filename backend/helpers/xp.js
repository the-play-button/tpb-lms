/**
 * XP and Badge Helpers
 * 
 * Uses crm_event for tracking and gamification_award for badges
 * Points are calculated from events, not stored separately
 */

/**
 * Record a quiz event in crm_event
 */
export async function recordQuizEvent(db, userId, quizId, courseId, classId, score, maxScore, passed, answers) {
    const now = new Date().toISOString();
    const id = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.prepare(`
        INSERT INTO crm_event (id, type, user_id, form_json, created_at, updated_at)
        VALUES (?, 'FORM', ?, ?, ?, ?)
    `).bind(
        id,
        userId,
        JSON.stringify({
            quiz_id: quizId,
            course_id: courseId,
            class_id: classId,
            name: `Quiz ${quizId}`,
            score,
            max_score: maxScore,
            passed: passed ? 1 : 0,
            fields: answers || []
        }),
        now,
        now
    ).run();
    
    return id;
}

/**
 * Award a badge to a user
 */
export async function awardBadge(db, userId, badgeId, courseId = null, classId = null) {
    const now = new Date().toISOString();
    const id = `award_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if already awarded
    const existing = await db.prepare(`
        SELECT 1 FROM gamification_award WHERE badge_id = ? AND user_id = ?
    `).bind(badgeId, userId).first();
    
    if (existing) return null;
    
    // Get badge info
    const badge = await db.prepare(`
        SELECT * FROM gamification_badge WHERE id = ? AND is_active = 1
    `).bind(badgeId).first();
    
    if (!badge) return null;
    
    // Award the badge
    await db.prepare(`
        INSERT INTO gamification_award (id, badge_id, user_id, user_type, course_id, class_id, awarded_at, created_at)
        VALUES (?, ?, ?, 'contact', ?, ?, ?, ?)
    `).bind(id, badgeId, userId, courseId, classId, now, now).run();
    
    // Also record as event
    await db.prepare(`
        INSERT INTO crm_event (id, type, user_id, raw_json, created_at, updated_at)
        VALUES (?, 'BADGE_EARNED', ?, ?, ?, ?)
    `).bind(
        `evt_badge_${id}`,
        userId,
        JSON.stringify({ badge_id: badgeId, points: badge.points_reward }),
        now,
        now
    ).run();
    
    return {
        id: badge.id,
        name: badge.name,
        description: badge.description,
        icon_url: badge.icon_url,
        points_reward: badge.points_reward,
        rarity: badge.rarity
    };
}

/**
 * Check and award quiz-related badges
 */
export async function checkQuizBadges(db, userId, isPerfect) {
    // Count passed quizzes
    const result = await db.prepare(`
        SELECT COUNT(*) as count 
        FROM crm_event 
        WHERE user_id = ? 
          AND type = 'FORM'
          AND json_extract(form_json, '$.passed') = 1
    `).bind(userId).first();
    
    const quizCount = result?.count || 0;
    
    if (quizCount === 1) {
        const earned = await awardBadge(db, userId, 'first_quiz');
        if (earned) return earned;
    }
    
    if (quizCount >= 10) {
        const earned = await awardBadge(db, userId, 'quiz_10');
        if (earned) return earned;
    }
    
    if (isPerfect) {
        const earned = await awardBadge(db, userId, 'perfect_quiz');
        if (earned) return earned;
    }
    
    return null;
}

/**
 * Get user's current streak (days of consecutive activity)
 */
export async function getCurrentStreak(db, userId) {
    // Get all activity dates
    const activities = await db.prepare(`
        SELECT DISTINCT date(created_at) as activity_date
        FROM crm_event
        WHERE user_id = ?
        ORDER BY activity_date DESC
        LIMIT 100
    `).bind(userId).all();
    
    if (!activities.results || activities.results.length === 0) {
        return 0;
    }
    
    const dates = activities.results.map(r => r.activity_date);
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    // If no activity today or yesterday, streak is broken
    if (dates[0] !== today && dates[0] !== yesterday) {
        return 0;
    }
    
    let streak = 1;
    let currentDate = new Date(dates[0]);
    
    for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(currentDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const expectedDate = prevDate.toISOString().split('T')[0];
        
        if (dates[i] === expectedDate) {
            streak++;
            currentDate = prevDate;
        } else {
            break;
        }
    }
    
    return streak;
}

/**
 * Check and award streak badges
 */
export async function checkStreakBadges(db, userId) {
    const streak = await getCurrentStreak(db, userId);
    
    if (streak >= 30) {
        const earned = await awardBadge(db, userId, 'streak_30');
        if (earned) return earned;
    }
    
    if (streak >= 7) {
        const earned = await awardBadge(db, userId, 'streak_7');
        if (earned) return earned;
    }
    
    return null;
}

/**
 * Check and award course completion badges
 * Called when course_completed becomes true
 */
export async function checkCourseCompletionBadges(db, userId, courseId) {
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
}

/**
 * Record course completion signal
 */
export async function recordCourseCompletion(db, userId, courseId) {
    const now = new Date().toISOString();
    const id = `sig_course_complete_${courseId}_${userId}_${Date.now()}`;
    
    // Check if already recorded
    const existing = await db.prepare(`
        SELECT 1 FROM lms_signal WHERE user_id = ? AND course_id = ? AND type = 'COURSE_COMPLETED'
    `).bind(userId, courseId).first();
    
    if (existing) return false;
    
    // Record completion signal
    await db.prepare(`
        INSERT INTO lms_signal (id, user_id, type, course_id, class_id, data_json, created_at)
        VALUES (?, ?, 'COURSE_COMPLETED', ?, 'final', '{}', ?)
    `).bind(id, userId, courseId, now).run();
    
    return true;
}
