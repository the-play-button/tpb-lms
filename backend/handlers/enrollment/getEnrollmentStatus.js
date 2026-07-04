/**
 * GET /api/enrollments/:courseId
 * Get enrollment status for a specific course
 */

import { jsonResponse, getUserId } from './_shared.js';
import { getUserEnrollmentStatus } from '../../services/enrollment/EnrollmentService.js';

export const getEnrollmentStatus = async (request, env, userContext, courseId) => {
    const userId = getUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    const result = await getUserEnrollmentStatus(env, userId, courseId);
    const out = result.error ?? result.value;
    return jsonResponse(out.body, out.status, request);
};
