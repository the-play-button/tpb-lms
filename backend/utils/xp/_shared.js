// entropy-positional-args-excess-ok: handler exports (awardBadge) use CF Worker positional convention (request, env, ctx)
/**
 * Shared XP/Badge helper - award a badge to a user
 */

/**
 * Award a badge to a user
 */
export const awardBadge = async (db, userId, badgeId, courseId = null, classId = null) => {
    const now = new Date().toISOString();
    const id = `award_${crypto.randomUUID()}`;

    const existing = await db.prepare(`
        SELECT 1 FROM gamification_award WHERE badge_id = ? AND user_id = ?
    `).bind(badgeId, userId).first();

    if (existing) return null;

    const badge = await db.prepare(`
        SELECT * FROM gamification_badge WHERE id = ? AND is_active = 1
    `).bind(badgeId).first();

    if (!badge) return null;

    await db.prepare(`
        INSERT INTO gamification_award (id, badge_id, user_id, user_type, course_id, class_id, awarded_at, created_at)
        VALUES (?, ?, ?, 'contact', ?, ?, ?, ?)
    `).bind(id, badgeId, userId, courseId, classId, now, now).run();

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
};
