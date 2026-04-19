// entropy-positional-args-excess-ok: handler exports (getAdminStats) use CF Worker positional convention (request, env, ctx)
// entropy-handler-service-pattern-ok: admin handler delegates to backend, minimal orchestration logic
/**
 * Admin Handlers
 *
 * Endpoints restricted to admin role
 */

import { jsonResponse } from '../cors.js';
import { requireRole } from '../middleware/guard.js';
import { log } from '@the-play-button/tpb-sdk-js';

/**
 * Get admin overview statistics
 * GET /api/admin/stats
 * 
 * @returns Global LMS statistics from v_admin_overview
 */
export const getAdminStats = async (request, env, userContext) => {
  const guardResult = requireRole('admin')(userContext);
  if (guardResult) {
    return jsonResponse({
      error: guardResult.error,
      requiredRole: guardResult.requiredRole,
      actualRole: guardResult.actualRole
    }, 403, request);
  }
  
  try {
    const stats = await env.DB.prepare(`
      SELECT * FROM v_admin_overview
    `).first();
    
    if (!stats) {
      return jsonResponse({
        error: 'No statistics available'
      }, 404, request);
    }
    
    log.info({ stats }, 'Admin stats retrieved');
    
    return jsonResponse({
      stats: {
        totalStudents: stats.total_students || 0,
        active24h: stats.active_24h || 0,
        active7d: stats.active_7d || 0,
        coursesCompleted: stats.courses_completed || 0,
        videosCompleted: stats.videos_completed || 0,
        quizzesPassed: stats.quizzes_passed || 0,
        avgQuizScore: stats.avg_quiz_score ? Math.round(stats.avg_quiz_score * 10) / 10 : null
      },
      timestamp: new Date().toISOString()
    }, 200, request);
    
  } catch (error) {
    log.error({ error: error.message }, 'Failed to get admin stats');
    return jsonResponse({
      error: 'Failed to retrieve admin statistics',
      details: error.message
    }, 500, request);
  }
};

