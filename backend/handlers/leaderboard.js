/**
 * Leaderboard Handler
 * 
 * Uses v_leaderboard view based on lms_signal.
 * Refactored for reduced complexity.
 */

import { jsonResponse } from '../cors.js';

// ============================================
// Helper functions
// ============================================

/**
 * Get user info from crm_contact or hris_employee
 */
async function getUserInfo(db, userId) {
    let user = await db.prepare(`
        SELECT id, name, json_extract(emails_json, '$[0].email') as email
        FROM crm_contact WHERE id = ?
    `).bind(userId).first();
    
    if (!user) {
        user = await db.prepare(`
            SELECT id, name, json_extract(emails_json, '$[0].email') as email
            FROM hris_employee WHERE id = ?
        `).bind(userId).first();
    }
    
    return user ? { id: user.id, name: user.name, email: user.email } : { id: userId };
}

/**
 * Get current user rank if not in top N
 */
async function getCurrentUserRank(db, userId) {
    const userStats = await db.prepare(`
        SELECT user_id, total_points FROM v_leaderboard WHERE user_id = ?
    `).bind(userId).first();
    
    if (!userStats) return { rank: null, points: 0 };
    
    const rankResult = await db.prepare(`
        SELECT COUNT(*) + 1 as rank FROM v_leaderboard WHERE total_points > ?
    `).bind(userStats.total_points).first();
    
    return { rank: rankResult?.rank, points: userStats.total_points };
}

/**
 * Calculate XP from stats
 */
function calculateXP(stats) {
    return ((stats?.video_completed_count || 0) * 50) + 
           ((stats?.quiz_passed_count || 0) * 100) + 
           ((stats?.course_completed_count || 0) * 200);
}

/**
 * Build stats object from raw data
 */
function buildStatsObject(stats) {
    return {
        video_completed_count: stats?.video_completed_count || 0,
        quiz_passed_count: stats?.quiz_passed_count || 0,
        step_completed_count: stats?.step_completed_count || 0,
        course_completed_count: stats?.course_completed_count || 0
    };
}

/**
 * Build activity object from raw data
 */
function buildActivityObject(activity) {
    return {
        last_event_at: activity?.last_event_at || null,
        events_24h: activity?.events_24h || 0,
        total_events: activity?.total_events || 0
    };
}

// ============================================
// Main handlers
// ============================================

export async function getLeaderboard(request, env, userContext) {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const userId = userContext.contact?.id || userContext.employee?.id;

    // Get leaderboard from view
    const results = await env.DB.prepare(`
        SELECT user_id, user_type, total_points, videos_completed, quizzes_completed, badges_earned
        FROM v_leaderboard LIMIT ?
    `).bind(limit).all();

    // Enrich with user info
    const leaderboard = await Promise.all(
        (results.results || []).map(async (entry, index) => ({
            rank: index + 1,
            user_id: entry.user_id,
            total_points: entry.total_points || 0,
            video_completed_count: entry.videos_completed || 0,
            quiz_passed_count: entry.quizzes_completed || 0,
            badges_count: entry.badges_earned || 0,
            user: await getUserInfo(env.DB, entry.user_id)
        }))
    );

    // Find current user position
    let currentUserEntry = leaderboard.find(e => e.user_id === userId);
    let currentUserRank = currentUserEntry?.rank;
    let currentUserPoints = currentUserEntry?.total_points;
    
    // If not in top N, fetch rank
    if (!currentUserEntry && userId) {
        const userRank = await getCurrentUserRank(env.DB, userId);
        currentUserRank = userRank.rank;
        currentUserPoints = userRank.points;
    }

    return jsonResponse({ 
        leaderboard,
        currentUser: { id: userId, rank: currentUserRank || null, total_points: currentUserPoints || 0 }
    }, 200, request);
}

export async function getUserStats(request, env, userContext) {
    const userId = userContext.contact?.id || userContext.employee?.id;
    
    if (!userId) {
        return jsonResponse({ error: 'User not authenticated' }, 401, request);
    }
    
    // Parallel fetch for better performance
    const [stats, activity, badges] = await Promise.all([
        env.DB.prepare(`SELECT * FROM v_signal_summary WHERE user_id = ?`).bind(userId).first(),
        env.DB.prepare(`SELECT * FROM v_user_activity WHERE user_id = ?`).bind(userId).first(),
        env.DB.prepare(`
            SELECT b.id, b.name, b.icon_url, b.rarity, a.awarded_at
            FROM gamification_award a JOIN gamification_badge b ON a.badge_id = b.id
            WHERE a.user_id = ? ORDER BY a.awarded_at DESC
        `).bind(userId).all()
    ]);
    
    return jsonResponse({
        user_id: userId,
        stats: buildStatsObject(stats),
        activity: buildActivityObject(activity),
        badges: badges.results || [],
        xp: { total: calculateXP(stats) }
    }, 200, request);
}
