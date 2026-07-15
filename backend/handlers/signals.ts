/**
 * Signals Handler — thin transport adapter over SignalsService.
 */

import { jsonResponse } from '../cors.js';
import { fetchCourseSignals, fetchStepSignals, resetProgress } from '../services/signals/SignalsService.js';
import { resolveUserId } from './_resolveUserId.js';
import type { Env } from "../types/Env.js";
import type { HandlerUserContext } from "../types/HandlerContext.js";

/**
 * GET /api/signals/:courseId
 */
export const getCourseSignalsHandler = async (request: Request, env: Env, userContext: HandlerUserContext, courseId: string): Promise<Response>  => {
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
export const getStepSignals = async (request: Request, env: Env, userContext: HandlerUserContext, courseId: string, classId: string): Promise<Response>  => {
    const userId = resolveUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    const result = await fetchStepSignals(env, userId, courseId, classId);
    if (result.notFound) return jsonResponse({ error: 'Class not found' }, 404, request);
    return jsonResponse(result.body, 200, request);
};

/**
 * DELETE /api/signals/:courseId
 */
export const deleteCourseSignals = async (request: Request, env: Env, userContext: HandlerUserContext, courseId: string): Promise<Response>  => {
    const userId = resolveUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    await resetProgress(env, userId, courseId);
    return jsonResponse({ success: true, message: 'Progress reset' }, 200, request);
};
