/**
 * Handle quiz submission from HTTP request
 */

import { submitQuizFromUser } from '../../services/quiz/QuizService.js';

export const createQuizSubmission = async (request, env, userContext) => {
    const body = await request.json();
    body.userId = userContext.contact.id;
    return submitQuizFromUser(env, request, body);
};
