/**
 * PATCH /api/enrollments/:courseId
 * Update an enrollment's status (body: { status: 'abandoned' | 'completed' }).
 * (Tier 1 update — abandon/complete are state transitions on the Enrollment.)
 */

import { jsonResponse, getUserId } from './_shared.js';
import { abandonUserCourse, completeUserCourse } from '../../services/enrollment/EnrollmentService.js';
import type { Env } from "../../types/Env.js";

export const updateEnrollment = async (request: Request, env: Env, userContext, courseId: string) => {
    const userId = getUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    let body = {};
    try { body = await request.json(); } catch { /* empty body → validated below */ }
    const status = body?.status;

    let result;
    if (status === 'abandoned') {
        result = await abandonUserCourse(env, userId, courseId);
    } else if (status === 'completed') {
        result = await completeUserCourse(env, userId, courseId);
    } else {
        return jsonResponse({ error: "status must be 'abandoned' or 'completed'" }, 400, request);
    }

    const out = result.error ?? result.value;
    return jsonResponse(out.body, out.status, request);
};
