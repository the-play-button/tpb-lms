/**
 * Leaderboard Handler — thin transport adapter over LeaderboardService.
 */

import { jsonResponse } from '../cors.js';
import { fetchLeaderboard, fetchUserStats } from '../services/leaderboard/LeaderboardService.js';

export const getLeaderboard = async (request, env, userContext) => {
    const limit = parseInt(new URL(request.url).searchParams.get('limit') || '10', 10);
    const { contact = {}, employee = {} } = userContext;
    const userId = contact.id || employee.id;
    const body = await fetchLeaderboard(env, userId, limit);
    return jsonResponse(body, 200, request);
};

export const getUserStats = async (request, env, userContext) => {
    const { contact: statsContact = {}, employee: statsEmployee = {} } = userContext;
    const userId = statsContact.id || statsEmployee.id;
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    const body = await fetchUserStats(env, userId);
    return jsonResponse(body, 200, request);
};
