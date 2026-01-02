/**
 * Admin Handlers
 * 
 * Endpoints restricted to admin role
 */

import { jsonResponse } from '../cors.js';
import { requireRole } from '../middleware/guard.js';
import logger from '../utils/log.js';

const log = logger('admin');

/**
 * Get admin overview statistics
 * GET /api/admin/stats
 * 
 * @returns Global LMS statistics from v_admin_overview
 */
export async function getAdminStats(request, env, userContext) {
  // Guard: Only admin role
  const guardResult = requireRole('admin')(userContext);
  if (guardResult) {
    return jsonResponse({
      error: guardResult.error,
      requiredRole: guardResult.requiredRole,
      actualRole: guardResult.actualRole
    }, 403, request);
  }
  
  try {
    // Query v_admin_overview view
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
}

