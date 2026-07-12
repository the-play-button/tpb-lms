/**
 * Leaderboard Handler — thin transport adapter over LeaderboardService.
 */

import { jsonResponse } from '../cors.js';
import { fetchLeaderboard, fetchUserStats } from '../services/leaderboard/LeaderboardService.js';
import type { Env } from "../types/Env.js";
import type { HandlerUserContext } from "../types/HandlerContext.js";

export const getLeaderboard = async (request: Request, env: Env, userContext: HandlerUserContext) => {
    const limit = parseInt(new URL(request.url).searchParams.get('limit') || '10', 10);
    const userId = userContext.contact?.id || userContext.employee?.id || '';
    const body = await fetchLeaderboard(env, userId, limit);
    return jsonResponse(body, 200, request);
};

export const getUserStats = async (request: Request, env: Env, userContext: HandlerUserContext) => {
    const userId = userContext.contact?.id || userContext.employee?.id;
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    const body = await fetchUserStats(env, userId);
    return jsonResponse(body, 200, request);
};
