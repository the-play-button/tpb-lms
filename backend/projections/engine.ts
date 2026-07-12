/**
 * Projection Engine
 * 
 * Generic projection system for event-sourcing.
 * 
 * Architecture:
 * - Events (lms_event) = SSOT, immutable
 * - Projections = pure reducers: (state, event) => newState
 * - v_user_progress = materialized view, updated on each event
 */

import { VIDEO_PROGRESS_PROJECTION } from './rules/video_progress.js';
import { QUIZ_RESULT_PROJECTION } from './rules/quiz_result.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { toError } from '../utils/toError.js';

export interface ProjectionKey { user_id: string; class_id: string; }

export interface ProjectionState {
    video_completed?: number;
    quiz_passed?: number;
    video_max_position_sec?: number;
    video_duration_sec?: number;
    video_completed_at?: string | null;
    quiz_score?: number;
    quiz_max_score?: number;
    quiz_passed_at?: string | null;
    [key: string]: unknown;
}

export interface ProjectionEvent {
    id?: string;
    type: string;
    user_id?: string;
    course_id?: string;
    class_id?: string;
    payload_json?: unknown;
    [key: string]: unknown;
}

export interface Projection {
    name: string;
    eventTypes: string[];
    getKey: (event: ProjectionEvent) => ProjectionKey;
    reduce: (state: ProjectionState, event: ProjectionEvent & { payload: unknown }) => ProjectionState;
}

const PROJECTIONS: Projection[] = [
    VIDEO_PROGRESS_PROJECTION,
    QUIZ_RESULT_PROJECTION
];

/**
 * Apply all matching projections for an event
 * Called after each INSERT into lms_event
 * 
 * @param {D1Database} db
 * @param {Object} event - { id, type, user_id, course_id, class_id, payload_json }
 * @returns {Object} - { video_completed, quiz_passed }
 */
export const applyProjections = async (db: D1Database, event: ProjectionEvent) => {
    const result: Record<string, unknown> = {};

    for (const projection of PROJECTIONS) {
        if (!projection.eventTypes.includes(event.type)) continue;
        
        try {
            const key = projection.getKey(event);
            const current = await getState(db, key);
            const payload = typeof event.payload_json === 'string' 
                ? JSON.parse(event.payload_json) 
                : event.payload_json;
            
            const next = projection.reduce(current || {}, { ...event, payload });
            await upsertState(db, key, event.course_id, next);
            
            if (projection.name === 'video_progress') {
                result.video_completed = next.video_completed === 1;
            }
            if (projection.name === 'quiz_result') {
                result.quiz_passed = next.quiz_passed === 1;
            }
            
            log.info('Projection applied', { name: projection.name, video_completed: next.video_completed, quiz_passed: next.quiz_passed });
        } catch (error) {
            log.error('Projection failed', toError(error), { name: projection.name });
            result[`${projection.name}_failed`] = true; // explicit failure marker — caller can detect
        }
    }

    return result;
};

/**
 * Get current state from v_user_progress
 */
const getState = async (db: D1Database, key: ProjectionKey) => {
    return await db.prepare(`
        SELECT * FROM v_user_progress
        WHERE user_id = ? AND class_id = ?
    `).bind(key.user_id, key.class_id).first<ProjectionState>();
}

/**
 * Upsert state into v_user_progress
 */
const upsertState = async (db: D1Database, key: ProjectionKey, courseId: string | undefined, state: ProjectionState) => {
    const now = new Date().toISOString();
    
    await db.prepare(`
        INSERT INTO v_user_progress (
            user_id, class_id, course_id,
            video_max_position_sec, video_duration_sec, video_completed, video_completed_at,
            quiz_passed, quiz_score, quiz_max_score, quiz_passed_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (user_id, class_id) DO UPDATE SET
            video_max_position_sec = excluded.video_max_position_sec,
            video_duration_sec = excluded.video_duration_sec,
            video_completed = excluded.video_completed,
            video_completed_at = COALESCE(excluded.video_completed_at, video_completed_at),
            quiz_passed = excluded.quiz_passed,
            quiz_score = excluded.quiz_score,
            quiz_max_score = excluded.quiz_max_score,
            quiz_passed_at = COALESCE(excluded.quiz_passed_at, quiz_passed_at),
            updated_at = excluded.updated_at
    `).bind(
        key.user_id,
        key.class_id,
        courseId,
        state.video_max_position_sec || 0,
        state.video_duration_sec || 0,
        state.video_completed || 0,
        state.video_completed_at || null,
        state.quiz_passed || 0,
        state.quiz_score || 0,
        state.quiz_max_score || 0,
        state.quiz_passed_at || null,
        now
    ).run();
}

/**
 * Get progress for a user/class
 */
export const getProgress = async (db: D1Database, userId: string, classId: string) => {
    return await db.prepare(`
        SELECT * FROM v_user_progress 
        WHERE user_id = ? AND class_id = ?
    `).bind(userId, classId).first();
};
