/**
 * GET /api/enrollments/:courseId
 * Get enrollment status for a specific course
 */

import { jsonResponse, getUserId } from './_shared.js';
import { getUserEnrollmentStatus } from '../../services/enrollment/EnrollmentService.js';
import type { Env } from "../../types/Env.js";
import type { HandlerUserContext } from "../../types/HandlerContext.js";

export const getEnrollmentStatus = async (request: Request, env: Env, userContext: HandlerUserContext, courseId: string) => {
    const userId = getUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    const result = await getUserEnrollmentStatus(env, userId, courseId);
    const out = result.error ?? result.value;
    return jsonResponse(out.body, out.status, request);
};
