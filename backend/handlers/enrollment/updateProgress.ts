/**
 * PATCH /api/enrollments/:id/progress
 * Update enrollment progress (called when navigating to a new step)
 */

import { jsonResponse, getUserId } from './_shared.js';
import { updateUserEnrollmentProgress } from '../../services/enrollment/EnrollmentService.js';
import type { Env } from "../../types/Env.js";
import type { HandlerUserContext } from "../../types/HandlerContext.js";

export const updateProgress = async (request: Request, env: Env, userContext: HandlerUserContext, enrollmentId: string): Promise<Response>  => {
    const userId = getUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    let body: { current_class_id?: string; completed_classes_count?: number };
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON' }, 400, request);
    }

    const result = await updateUserEnrollmentProgress(env, userId, enrollmentId, body);
    const out = 'error' in result ? result.error : result.value;
    return jsonResponse(out.body, out.status, request);
};
