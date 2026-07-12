/**
 * Video Progress Projection
 * 
 * VIDEO_PING events → v_user_progress.video_*
 * 
 * Simple logic: track max position reached, complete at 90%
 */

import type { Projection, ProjectionEvent, ProjectionKey, ProjectionState } from '../engine.js';

interface VideoPayload { position_sec?: number; duration_sec?: number; }

export const VIDEO_PROGRESS_PROJECTION: Projection = {
    name: 'video_progress',
    eventTypes: ['VIDEO_PING'],

    /**
     * Extract key from event
     */
    getKey(event: ProjectionEvent): ProjectionKey {
        return {
            user_id: event.user_id ?? '',
            class_id: event.class_id ?? ''
        };
    },

    /**
     * Reduce: (currentState, event) => newState
     * Pure function, no side effects
     */
    reduce(state: ProjectionState, event: ProjectionEvent & { payload: unknown }): ProjectionState {
        const payload = (event.payload ?? {}) as VideoPayload;
        const position = payload.position_sec || 0;
        const duration = payload.duration_sec || state.video_duration_sec || 0;
        
        const newMaxPosition = Math.max(state.video_max_position_sec || 0, position);
        
        const wasCompleted = state.video_completed === 1;
        const isCompleted = duration > 0 && newMaxPosition >= 0.9 * duration;
        
        return {
            ...state,
            video_max_position_sec: newMaxPosition,
            video_duration_sec: duration,
            video_completed: isCompleted ? 1 : 0,
            video_completed_at: isCompleted && !wasCompleted 
                ? new Date().toISOString() 
                : state.video_completed_at
        };
    }
};

