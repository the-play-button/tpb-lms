/**
 * Admin Handlers — endpoints restricted to admin role.
 */

import { jsonResponse } from '../cors.js';
import { requireRole } from '../middleware/guard.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { fetchAdminStats } from '../services/admin/AdminService.js';
import type { Env } from "../types/Env.js";
import type { HandlerUserContext } from "../types/HandlerContext.js";
import { toError } from "../utils/toError.js";

/**
 * Get admin overview statistics
 * GET /api/admin/stats
 */
export const getAdminStats = async (request: Request, env: Env, userContext: HandlerUserContext) => {
    const guardResult = requireRole('admin')(userContext);
    if (guardResult) {
        return jsonResponse({
            error: guardResult.error,
            requiredRole: guardResult.requiredRole,
            actualRole: guardResult.actualRole,
        }, 403, request);
    }

    try {
        const stats = await fetchAdminStats(env);
        if (!stats) return jsonResponse({ error: 'No statistics available' }, 404, request);
        log.info('Admin stats retrieved', { stats });
        return jsonResponse({ stats, timestamp: new Date().toISOString() }, 200, request);
    } catch (error) {
        log.error('Failed to get admin stats', toError(error));
        return jsonResponse({ error: 'Failed to retrieve admin statistics', details: toError(error).message }, 500, request);
    }
};
