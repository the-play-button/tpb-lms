/**
 * Get user's current streak (days of consecutive activity)
 */

export const getCurrentStreak = async (db: D1Database, userId: string) => {
    const activities = await db.prepare(`
        SELECT DISTINCT date(created_at) as activity_date
        FROM crm_event
        WHERE user_id = ?
        ORDER BY activity_date DESC
        LIMIT 100
    `).bind(userId).all<{ activity_date: string }>();

    if (!activities.results || activities.results.length === 0) {
        return 0;
    }

    const dates = activities.results.map((row) => row.activity_date);
    const first = dates[0];
    if (!first) return 0;

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (first !== today && first !== yesterday) {
        return 0;
    }

    let streak = 1;
    let currentDate = new Date(first);

    for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(currentDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const expectedDate = prevDate.toISOString().slice(0, 10);

        if (dates[i] === expectedDate) {
            streak++;
            currentDate = prevDate;
        } else {
            break;
        }
    }

    return streak;
};
