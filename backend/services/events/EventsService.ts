/**
 * EventsService — persist LMS events + apply projections + derive completion state.
 */

import { applyProjections, getProgress } from '../../projections/engine.js';
import { generateEventId } from '../../utils/events.js';
import type { Env } from "../../types/Env.js";

import type { ValidatedEvent } from './EventsService.types';
export type { ValidatedEvent };



type ValidateEventResult =
    | { success: true; data: ValidatedEvent }
    | { success: false; error: unknown };
type ValidateEventFn = (evt: unknown) => ValidateEventResult;

interface BatchEntry { data?: ValidatedEvent; error?: unknown; }

export const persistValidatedEvent = async (env: Env, userId: string, validatedData: ValidatedEvent): Promise<{
    eventId: string;
    class_id: string;
}>  => {
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

export const classHasQuiz = async (env: Env, classId: string): Promise<boolean>  => {
    const cls = await env.DB.prepare('SELECT media_json FROM lms_class WHERE id = ?')
        .bind(classId).first<{ media_json?: string | null }>();
    if (!cls?.media_json) return false;
    const media = JSON.parse(cls.media_json) as Array<{ type?: string }>;
    return media.some((m) => m?.type === 'QUIZ');
};

export const deriveCompletionState = async (env: Env, userId: string, classId: string): Promise<{
    video_completed: boolean;
    quiz_passed: boolean;
    step_completed: boolean;
}>  => {
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

export const validateBatch = (events: unknown[], validateEvent: ValidateEventFn): BatchEntry[] => {
    const out: BatchEntry[] = [];
    for (const evt of events) {
        const v = validateEvent(evt);
        out.push(v.success ? { data: v.data } : { error: v.error });
    }
    return out;
};

export const persistBatch = async (env: Env, userId: string, validatedEntries: BatchEntry[]): Promise<{
    results: {
        success: boolean;
        error?: unknown;
        event_id?: string;
    }[];
    succeeded: number;
}>  => {
    const results: Array<{ success: boolean; error?: unknown; event_id?: string }> = [];
    let succeeded = 0;
    for (const entry of validatedEntries) {
        if (entry.error || !entry.data) {
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
