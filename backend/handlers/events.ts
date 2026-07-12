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

const createSingleEvent = async (request, env, userId, body) => {
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

const createBatchEvents = async (request, env, userId, events) => {
    if (!Array.isArray(events) || events.length === 0) {
        return jsonResponse({ error: 'events must be a non-empty array' }, 400, request);
    }
    const validatedEntries = validateBatch(events, validateEvent);
    const { results, succeeded } = await persistBatch(env, userId, validatedEntries);
    return jsonResponse({ success: true, total: events.length, succeeded, results }, 201, request);
};

/**
 * POST /api/events — create one event (single object body) OR a bulk of events
 * (body { events: [...] }). Tier 1 create accepting single-or-array — no separate
 * /batch endpoint (cf. crud_list_only_endpoint_design § Q3 bulk-create).
 */
export const createEvents = async (request, env, userContext) => {
    const authed = await resolveAuthedJsonBody(request, userContext);
    if (authed.errorResponse) return authed.errorResponse;
    const { userId, body } = authed;

    if (Array.isArray(body?.events)) {
        return createBatchEvents(request, env, userId, body.events);
    }
    return createSingleEvent(request, env, userId, body);
};
