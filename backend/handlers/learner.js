/**
 * Learner Progress Handler — thin transport adapter.
 */

import { jsonResponse } from '../cors.js';
import { fetchLearnerProgress } from '../services/learner/LearnerProgressService.js';

export const getLearnerProgress = async (request, env, userContext) => {
    const userId = userContext.contact.id;
    const body = await fetchLearnerProgress(env, userId, userContext.user.email);
    return jsonResponse(body, 200, request);
};
