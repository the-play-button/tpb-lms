/**
 * Check and award streak badges
 */

import { awardBadge } from './_shared.js';
import { getCurrentStreak } from './getCurrentStreak.js';

export const checkStreakBadges = async (db, userId) => {
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
};
