import type { Env } from "../../types/Env.js";

/**
 * AdminService — admin-only aggregated stats.
 */

const projectAdminStats = (stats) => ({
    totalStudents: stats.total_students || 0,
    active24h: stats.active_24h || 0,
    active7d: stats.active_7d || 0,
    coursesCompleted: stats.courses_completed || 0,
    videosCompleted: stats.videos_completed || 0,
    quizzesPassed: stats.quizzes_passed || 0,
    avgQuizScore: stats.avg_quiz_score ? Math.round(stats.avg_quiz_score * 10) / 10 : null,
});

export const fetchAdminStats = async (env: Env) => {
    const stats = await env.DB.prepare('SELECT * FROM v_admin_overview').first();
    if (!stats) return null;
    return projectAdminStats(stats);
};
