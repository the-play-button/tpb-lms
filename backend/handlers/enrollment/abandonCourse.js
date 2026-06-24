/**
 * POST /api/courses/:id/abandon
 * Abandon a course enrollment
 */

import { jsonResponse, getUserId } from './_shared.js';
import { abandonUserCourse } from '../../services/enrollment/EnrollmentService.js';

export const abandonCourse = async (request, env, userContext, courseId) => {
    const userId = getUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    const result = await abandonUserCourse(env, userId, courseId);
    const out = result.error ?? result.value;
    return jsonResponse(out.body, out.status, request);
};
