/**
 * Courses Handler — thin transport adapter over CoursesService.
 */

import { jsonResponse } from '../cors.js';
import { listCoursesForUser, getCourseForUser } from '../services/courses/CoursesService.js';
import { resolveUserId } from './_resolveUserId.js';
import type { Env } from "../types/Env.js";

/**
 * GET /api/courses
 * Supports ?lang= parameter for translations
 */
export const listCourses = async (request: Request, env: Env, userContext) => {
    const userId = resolveUserId(userContext);
    const lang = new URL(request.url).searchParams.get('lang');
    const body = await listCoursesForUser(env, userId, lang);
    return jsonResponse(body, 200, request);
};

/**
 * GET /api/courses/:id
 * Supports ?lang= parameter for translations
 */
export const getCourse = async (request: Request, env: Env, userContext, courseId: string) => {
    const userId = resolveUserId(userContext);
    const lang = new URL(request.url).searchParams.get('lang');
    const result = await getCourseForUser(env, userId, courseId, lang);
    if (result.notFound) return jsonResponse({ error: 'Course not found' }, 404, request);
    return jsonResponse(result.body, 200, request);
};
