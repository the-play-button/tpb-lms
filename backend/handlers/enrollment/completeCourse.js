/**
 * POST /api/courses/:id/complete
 * Mark a course as completed (called internally when all steps are done)
 */

import { jsonResponse, getUserId } from './_shared.js';
import { completeUserCourse } from '../../services/enrollment/EnrollmentService.js';

export const completeCourse = async (request, env, userContext, courseId) => {
    const userId = getUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    const result = await completeUserCourse(env, userId, courseId);
    const out = result.error ?? result.value;
    return jsonResponse(out.body, out.status, request);
};
