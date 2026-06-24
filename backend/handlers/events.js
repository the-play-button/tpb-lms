/**
 * Events Handler
 *
 * Receives and stores LMS events, then applies projections.
 *
 * Flow:
 * 1. Validate & store event in lms_event (SSOT)
 * 2. Apply projections → update v_user_progress
 * 3. Return current state to frontend
 */

import { jsonResponse } from '../cors.js';
import { applyProjections, getProgress } from '../projections/engine.js';
import { validateEvent } from '../schemas/events.js';
import { generateEventId, storeEvent } from '../utils/events.js';
import { log } from '@the-play-button/tpb-sdk-js';

/**
 * Extracts userId from CF Access userContext (contact or employee).
 * Returns null when neither identity is present.
 */
const resolveUserId = (userContext) => userContext.contact?.id || userContext.employee?.id || null;

/**
 * Resolve userId + parse JSON body in one shot.
 * Returns { userId, body } on success, or { errorResponse: Response } when
 * either authentication or JSON parsing fails (caller short-circuits on it).
 */
const resolveAuthedJsonBody = async (request, userContext) => {
    const userId = resolveUserId(userContext);
    if (!userId) {
        return { errorResponse: jsonResponse({ error: 'User not authenticated' }, 401, request) };
    }
    try {
        return { userId, body: await request.json() };
    } catch {
        return { errorResponse: jsonResponse({ error: 'Invalid JSON body' }, 400, request) };
    }
};

/**
 * Persist one validated event to lms_event and apply projections.
 * Returns { eventId } on success or throws when DB insert fails.
 */
const persistValidatedEvent = async (env, userId, validatedData) => {
    const { type, course_id, class_id, payload } = validatedData;
    const eventId = generateEventId();
    const now = new Date().toISOString();

    await env.DB.prepare(`
        INSERT INTO lms_event (id, type, user_id, course_id, class_id, occurred_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(eventId, type, userId, course_id, class_id, now, JSON.stringify(payload)).run();

    await applyProjections(env.DB, {
        id: eventId,
        type,
        user_id: userId,
        course_id,
        class_id,
        payload_json: JSON.stringify(payload),
    });

    return { eventId, class_id };
};

/**
 * POST /api/events
 */
export const handleEvent = async (request, env, userContext) => {
    const authed = await resolveAuthedJsonBody(request, userContext);
    if (authed.errorResponse) return authed.errorResponse;
    const { userId, body } = authed;

    const validation = validateEvent(body);
    if (!validation.success) return jsonResponse({ error: validation.error }, 400, request);

    let eventId;
    let classId;
    try {
        ({ eventId, class_id: classId } = await persistValidatedEvent(env, userId, validation.data));
    } catch (e) {
        log.error('event store failed', e, { file: 'handlers/events.js' });
        return jsonResponse({ error: 'Failed to store event' }, 500, request);
    }

    const progress = await getProgress(env.DB, userId, classId);
    const hasQuiz = await checkHasQuiz(env.DB, classId);

    const videoCompleted = progress?.video_completed === 1;
    const quizPassed = progress?.quiz_passed === 1;
    const stepCompleted = videoCompleted && (!hasQuiz || quizPassed);

    return jsonResponse({
        success: true,
        event_id: eventId,
        video_completed: videoCompleted,
        quiz_passed: quizPassed,
        step_completed: stepCompleted,
    }, 201, request);
};

/**
 * Check if class has a quiz
 */
const checkHasQuiz = async (db, classId) => {
    const cls = await db.prepare(`
        SELECT media_json FROM lms_class WHERE id = ?
    `).bind(classId).first();

    if (!cls?.media_json) return false;

    return JSON.parse(cls.media_json).some(({ type } = {}) => type === 'QUIZ');
};

/**
 * Handle batch events (for offline sync)
 */
export const handleBatchEvents = async (request, env, userContext) => {
    const authed = await resolveAuthedJsonBody(request, userContext);
    if (authed.errorResponse) return authed.errorResponse;
    const { userId, body } = authed;

    const { events } = body;

    if (!Array.isArray(events) || events.length === 0) {
        return jsonResponse({ error: 'events must be a non-empty array' }, 400, request);
    }

    const results = [];
    for (const evt of events) {
        const validation = validateEvent(evt);
        if (!validation.success) {
            results.push({ success: false, error: validation.error });
            continue;
        }
        try {
            const { eventId } = await persistValidatedEvent(env, userId, validation.data);
            results.push({ success: true, event_id: eventId });
        } catch {
            results.push({ success: false, error: 'Database error' });
        }
    }

    return jsonResponse({
        success: true,
        total: events.length,
        succeeded: results.filter(({ success } = {}) => success).length,
        results,
    }, 201, request);
};
