/**
 * LearnerProgressService — aggregated learner progress projections.
 */

import { getCurrentStreak } from '../../utils/xp/index.js';
import type { Env } from "../../types/Env.js";

const queryUserStats = (env: Env, userId: string) =>
    env.DB.prepare('SELECT * FROM v_user_stats WHERE user_id = ?').bind(userId).first();

interface LeaderboardStatsRow {
    total_points?: number;
    videos_completed?: number;
    quizzes_completed?: number;
    badges_earned?: number;
    [key: string]: unknown;
}

const queryUserLeaderboardRow = (env: Env, userId: string) =>
    env.DB.prepare('SELECT * FROM v_leaderboard WHERE user_id = ?').bind(userId).first<LeaderboardStatsRow>();

const queryUserBadges = (env: Env, userId: string) =>
    env.DB.prepare(`
        SELECT b.*, a.awarded_at FROM gamification_award a
        JOIN gamification_badge b ON b.id = a.badge_id
        WHERE a.user_id = ? ORDER BY a.awarded_at DESC
    `).bind(userId).all();

const queryRecentVideos = (env: Env, userId: string) =>
    env.DB.prepare(`
        SELECT id, json_extract(page_view_json, '$.video_id') as video_id,
            json_extract(page_view_json, '$.course_id') as course_id,
            json_extract(page_view_json, '$.completion') as completion, created_at
        FROM crm_event WHERE user_id = ? AND type = 'VIDEO_VIEW'
        ORDER BY created_at DESC LIMIT 20
    `).bind(userId).all();

const queryRecentQuizzes = (env: Env, userId: string) =>
    env.DB.prepare(`
        SELECT id, json_extract(form_json, '$.quiz_id') as quiz_id,
            json_extract(form_json, '$.course_id') as course_id,
            json_extract(form_json, '$.score') as score,
            json_extract(form_json, '$.max_score') as max_score,
            json_extract(form_json, '$.passed') as passed, created_at
        FROM crm_event WHERE user_id = ? AND type = 'FORM'
        ORDER BY created_at DESC LIMIT 20
    `).bind(userId).all();

export const fetchLearnerProgress = async (env: Env, userId: string, userEmail: string | null) => {
    const [stats, leaderboard, badges, videos, quizzes, currentStreak] = await Promise.all([
        queryUserStats(env, userId),
        queryUserLeaderboardRow(env, userId),
        queryUserBadges(env, userId),
        queryRecentVideos(env, userId),
        queryRecentQuizzes(env, userId),
        getCurrentStreak(env.DB, userId),
    ]);

    const totalPoints = leaderboard?.total_points || 0;
    return {
        user: {
            id: userId,
            email: userEmail,
            total_points: totalPoints,
            level: Math.floor(totalPoints / 1000) + 1,
            level_progress: (totalPoints % 1000) / 10,
            current_streak: currentStreak,
            videos_completed: leaderboard?.videos_completed || 0,
            quizzes_completed: leaderboard?.quizzes_completed || 0,
            badges_earned: leaderboard?.badges_earned || 0,
        },
        stats: stats || { total_activities: 0 },
        badges: badges.results || [],
        recentVideos: videos.results || [],
        recentQuizzes: quizzes.results || [],
    };
};
