/**
 * Handle quiz submission from HTTP request
 */

import { submitQuizFromUser } from '../../services/quiz/QuizService.js';
import type { Env } from "../../types/Env.js";

export const createQuizSubmission = async (request: Request, env: Env, userContext) => {
    const body = await request.json();
    body.userId = userContext.contact.id;
    return submitQuizFromUser(env, request, body);
};
