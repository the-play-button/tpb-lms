/**
 * Check and award quiz-related badges
 */

import { awardBadge } from './_shared.js';

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
