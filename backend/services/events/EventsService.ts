/**
 * EventsService — persist LMS events + apply projections + derive completion state.
 */

import { applyProjections, getProgress } from '../../projections/engine.js';
import { generateEventId } from '../../utils/events.js';
import type { Env } from "../../types/Env.js";

export const persistValidatedEvent = async (env: Env, userId: string, validatedData) => {
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

export const classHasQuiz = async (env: Env, classId: string) => {
    const cls = await env.DB.prepare('SELECT media_json FROM lms_class WHERE id = ?')
        .bind(classId).first();
    if (!cls?.media_json) return false;
    return JSON.parse(cls.media_json).some(({ type } = {}) => type === 'QUIZ');
};

export const deriveCompletionState = async (env: Env, userId: string, classId: string) => {
    const progress = await getProgress(env.DB, userId, classId);
    const hasQuiz = await classHasQuiz(env, classId);
    const videoCompleted = progress?.video_completed === 1;
    const quizPassed = progress?.quiz_passed === 1;
    return {
        video_completed: videoCompleted,
        quiz_passed: quizPassed,
        step_completed: videoCompleted && (!hasQuiz || quizPassed),
    };
};

export const validateBatch = (events, validateEvent) => {
    const out = [];
    for (const evt of events) {
        const v = validateEvent(evt);
        out.push(v.success ? { data: v.data } : { error: v.error });
    }
    return out;
};

export const persistBatch = async (env: Env, userId: string, validatedEntries) => {
    const results = [];
    let succeeded = 0;
    for (const entry of validatedEntries) {
        if (entry.error) {
            results.push({ success: false, error: entry.error });
            continue;
        }
        try {
            const { eventId } = await persistValidatedEvent(env, userId, entry.data);
            results.push({ success: true, event_id: eventId });
            succeeded += 1;
        } catch {
            results.push({ success: false, error: 'Database error' });
        }
    }
    return { results, succeeded };
};
