/**
 * Signals Handler — thin transport adapter over SignalsService.
 */

import { jsonResponse } from '../cors.js';
import { fetchCourseSignals, fetchStepSignals, resetProgress } from '../services/signals/SignalsService.js';
import { resolveUserId } from './_resolveUserId.js';

/**
 * GET /api/signals/:courseId
 */
export const getCourseSignalsHandler = async (request, env, userContext, courseId) => {
    const userId = resolveUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    const result = await fetchCourseSignals(env, userId, courseId);
    if (result.corrupted) {
        return jsonResponse({
            error: 'PROGRESS_RESET',
            message: 'État incohérent détecté. Progression réinitialisée.',
            reload: true,
        }, 409, request);
    }
    return jsonResponse(result.body, 200, request);
};

/**
 * GET /api/signals/:courseId/:classId
 */
export const getStepSignals = async (request, env, userContext, courseId, classId) => {
    const userId = resolveUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    const result = await fetchStepSignals(env, userId, courseId, classId);
    if (result.notFound) return jsonResponse({ error: 'Class not found' }, 404, request);
    return jsonResponse(result.body, 200, request);
};

/**
 * DELETE /api/signals/:courseId
 */
export const deleteCourseSignals = async (request, env, userContext, courseId) => {
    const userId = resolveUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    await resetProgress(env, userId, courseId);
    return jsonResponse({ success: true, message: 'Progress reset' }, 200, request);
};
