/**
 * POST /api/courses/:id/enroll
 * Enroll in a course
 */

import { jsonResponse, getUserId } from './_shared.js';
import { enrollUserInCourse } from '../../services/enrollment/EnrollmentService.js';

export const enrollInCourse = async (request, env, userContext, courseId) => {
    const userId = getUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    const result = await enrollUserInCourse(env, userId, courseId);
    const out = result.error ?? result.value;
    return jsonResponse(out.body, out.status, request);
};
