/**
 * POST /api/enrollments
 * Create an enrollment for the current user (body: { courseId }).
 * (Tier 1 create — "enroll" is creating an Enrollment entity.)
 */

import { jsonResponse, getUserId } from './_shared.js';
import { enrollUserInCourse } from '../../services/enrollment/EnrollmentService.js';
import type { Env } from "../../types/Env.js";
import type { HandlerUserContext } from "../../types/HandlerContext.js";

export const createEnrollment = async (request: Request, env: Env, userContext: HandlerUserContext) => {
    const userId = getUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    let body = {};
    try { body = await request.json(); } catch { /* empty body → validated below */ }
    const courseId = body?.courseId ?? body?.course_id;
    if (!courseId) return jsonResponse({ error: 'courseId is required' }, 400, request);

    const result = await enrollUserInCourse(env, userId, courseId);
    const out = result.error ?? result.value;
    return jsonResponse(out.body, out.status, request);
};
