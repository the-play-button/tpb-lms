/**
 * Learner Progress Handler — thin transport adapter.
 */

import { jsonResponse } from '../cors.js';
import { fetchLearnerProgress } from '../services/learner/LearnerProgressService.js';
import type { Env } from "../types/Env.js";
import type { HandlerUserContext } from "../types/HandlerContext.js";

export const getLearnerProgress = async (request: Request, env: Env, userContext: HandlerUserContext) => {
    const userId = userContext.contact.id;
    const body = await fetchLearnerProgress(env, userId, userContext.user.email);
    return jsonResponse(body, 200, request);
};
