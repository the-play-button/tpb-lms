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
import { generateEventId, storeEvent } from '../helpers/events.js';

/**
 * POST /api/events
 */
export async function handleEvent(request, env, userContext) {
    const userId = userContext.contact?.id || userContext.employee?.id;
    
    if (!userId) {
        return jsonResponse({ error: 'User not authenticated' }, 401, request);
    }
    
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400, request);
    }
    
    // Validate with Zod schema (GAP-710, GAP-1210)
    const validation = validateEvent(body);
    if (!validation.success) {
        return jsonResponse({ error: validation.error }, 400, request);
    }
    
    const { type, course_id, class_id, payload } = validation.data;
    
    // 1. Store event (SSOT)
    const eventId = generateEventId();
    const now = new Date().toISOString();
    
    try {
        await env.DB.prepare(`
            INSERT INTO lms_event (id, type, user_id, course_id, class_id, occurred_at, payload_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(eventId, type, userId, course_id, class_id, now, JSON.stringify(payload)).run();
    } catch (e) {
        console.error('Failed to store event:', e);
        return jsonResponse({ error: 'Failed to store event' }, 500, request);
    }
    
    // 2. Apply projections → update v_user_progress
    const event = {
        id: eventId,
        type,
        user_id: userId,
        course_id,
        class_id,
        payload_json: JSON.stringify(payload)
    };
    
    const projectionResult = await applyProjections(env.DB, event);
    
    // 3. Get current state for response
    const progress = await getProgress(env.DB, userId, class_id);
    const hasQuiz = await checkHasQuiz(env.DB, class_id);
    
    const videoCompleted = progress?.video_completed === 1;
    const quizPassed = progress?.quiz_passed === 1;
    const stepCompleted = videoCompleted && (!hasQuiz || quizPassed);
    
    return jsonResponse({
        success: true,
        event_id: eventId,
        video_completed: videoCompleted,
        quiz_passed: quizPassed,
        step_completed: stepCompleted
    }, 201, request);
}

/**
 * Check if class has a quiz
 */
async function checkHasQuiz(db, classId) {
    const cls = await db.prepare(`
        SELECT media_json FROM lms_class WHERE id = ?
    `).bind(classId).first();
    
    if (!cls?.media_json) return false;
    
    const media = JSON.parse(cls.media_json);
    return media.some(m => m.type === 'QUIZ');
}

/**
 * Handle batch events (for offline sync)
 */
export async function handleBatchEvents(request, env, userContext) {
    const userId = userContext.contact?.id || userContext.employee?.id;
    
    if (!userId) {
        return jsonResponse({ error: 'User not authenticated' }, 401, request);
    }
    
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400, request);
    }
    
    const { events } = body;
    
    if (!Array.isArray(events) || events.length === 0) {
        return jsonResponse({ error: 'events must be a non-empty array' }, 400, request);
    }
    
    const results = [];
    
    for (const evt of events) {
        // Validate with Zod schema
        const validation = validateEvent(evt);
        if (!validation.success) {
            results.push({ success: false, error: validation.error });
            continue;
        }
        
        const { type, course_id, class_id, payload } = validation.data;
        
        const eventId = generateEventId();
        const now = new Date().toISOString();
        
        try {
            await env.DB.prepare(`
                INSERT INTO lms_event (id, type, user_id, course_id, class_id, occurred_at, payload_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(eventId, type, userId, course_id, class_id, now, JSON.stringify(payload)).run();
            
            // Apply projection
            await applyProjections(env.DB, {
                id: eventId,
                type,
                user_id: userId,
                course_id,
                class_id,
                payload_json: JSON.stringify(payload)
            });
            
            results.push({ success: true, event_id: eventId });
        } catch (e) {
            results.push({ success: false, error: 'Database error' });
        }
    }
    
    return jsonResponse({
        success: true,
        total: events.length,
        succeeded: results.filter(r => r.success).length,
        results
    }, 201, request);
}
