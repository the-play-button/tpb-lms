/**
 * PATCH /api/enrollments/:id/progress
 * Update enrollment progress (called when navigating to a new step)
 */

import { jsonResponse, getUserId } from './_shared.js';
import { updateUserEnrollmentProgress } from '../../services/enrollment/EnrollmentService.js';
import type { Env } from "../../types/Env.js";

export const updateProgress = async (request: Request, env: Env, userContext, enrollmentId: string) => {
    const userId = getUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON' }, 400, request);
    }

    const result = await updateUserEnrollmentProgress(env, userId, enrollmentId, body);
    const out = result.error ?? result.value;
    return jsonResponse(out.body, out.status, request);
};
