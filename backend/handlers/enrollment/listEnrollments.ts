/**
 * GET /api/enrollments
 * List all enrollments for the current user
 */

import { jsonResponse, getUserId } from './_shared.js';
import { listUserEnrollments } from '../../services/enrollment/EnrollmentService.js';
import type { Env } from "../../types/Env.js";
import type { HandlerUserContext } from "../../types/HandlerContext.js";

export const listEnrollments = async (request: Request, env: Env, userContext: HandlerUserContext): Promise<Response>  => {
    const userId = getUserId(userContext);
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);

    const status = new URL(request.url).searchParams.get('status') ?? undefined;
    const result = await listUserEnrollments(env, userId, status);
    const out = 'error' in result ? result.error : result.value;
    return jsonResponse(out.body, out.status, request);
};
