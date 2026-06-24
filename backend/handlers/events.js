/**
 * Events Handler — thin transport adapter over EventsService.
 *
 * Flow per POST /api/events :
 * 1. Authenticate user (= CF Access userContext)
 * 2. Parse JSON body + validate against zod schema
 * 3. Delegate persistence + projection to EventsService
 * 4. Return current completion state to the frontend
 */

import { jsonResponse } from '../cors.js';
import { validateEvent } from '../schemas/events.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { persistValidatedEvent, deriveCompletionState, persistBatch, validateBatch } from '../services/events/EventsService.js';
import { resolveUserId } from './_resolveUserId.js';

const resolveAuthedJsonBody = async (request, userContext) => {
    const userId = resolveUserId(userContext);
    if (!userId) return { errorResponse: jsonResponse({ error: 'User not authenticated' }, 401, request) };
    try {
        return { userId, body: await request.json() };
    } catch {
        return { errorResponse: jsonResponse({ error: 'Invalid JSON body' }, 400, request) };
    }
};

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

    const completion = await deriveCompletionState(env, userId, classId);
    return jsonResponse({ success: true, event_id: eventId, ...completion }, 201, request);
};

export const handleBatchEvents = async (request, env, userContext) => {
    const authed = await resolveAuthedJsonBody(request, userContext);
    if (authed.errorResponse) return authed.errorResponse;
    const { userId, body } = authed;

    const { events } = body;
    if (!Array.isArray(events) || events.length === 0) {
        return jsonResponse({ error: 'events must be a non-empty array' }, 400, request);
    }

    const validatedEntries = validateBatch(events, validateEvent);
    const { results, succeeded } = await persistBatch(env, userId, validatedEntries);
    return jsonResponse({
        success: true,
        total: events.length,
        succeeded,
        results,
    }, 201, request);
};
