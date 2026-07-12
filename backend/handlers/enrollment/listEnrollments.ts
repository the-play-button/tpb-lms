/**
 * GET /api/enrollments
 * List all enrollments for the current user
 */

import { jsonResponse, getUserId } from './_shared.js';
import { listUserEnrollments } from '../../services/enrollment/EnrollmentService.js';

export const listEnrollments = async (request, env, userContext) => {
    const userId = getUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    const status = new URL(request.url).searchParams.get('status');
    const result = await listUserEnrollments(env, userId, status);
    const out = result.error ?? result.value;
    return jsonResponse(out.body, out.status, request);
};
