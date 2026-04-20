/**
 * Get user's current streak (days of consecutive activity)
 */

export const getCurrentStreak = async (db, userId) => {
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

    const dates = activities.results.map(({ activity_date } = {}) => activity_date);

    if (dates[0] !== new Date().toISOString().split('T')[0] && dates[0] !== new Date(Date.now() - 86400000).toISOString().split('T')[0]) {
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
};
