/**
 * Video Progress Projection
 * 
 * VIDEO_PING events → v_user_progress.video_*
 * 
 * Simple logic: track max position reached, complete at 90%
 */

export const VIDEO_PROGRESS_PROJECTION = {
    name: 'video_progress',
    eventTypes: ['VIDEO_PING'],
    
    /**
     * Extract key from event
     */
    getKey(event) {
        return {
            user_id: event.user_id,
            class_id: event.class_id
        };
    },
    
    /**
     * Reduce: (currentState, event) => newState
     * Pure function, no side effects
     */
    reduce(state, event) {
        const payload = event.payload;
        const position = payload.position_sec || 0;
        const duration = payload.duration_sec || state.video_duration_sec || 0;
        
        // Track max position reached
        const newMaxPosition = Math.max(state.video_max_position_sec || 0, position);
        
        // Complete at 90% of duration
        const wasCompleted = state.video_completed === 1;
        const isCompleted = duration > 0 && newMaxPosition >= 0.9 * duration;
        
        return {
            ...state,
            video_max_position_sec: newMaxPosition,
            video_duration_sec: duration,
            video_completed: isCompleted ? 1 : 0,
            // Only set completed_at on first completion
            video_completed_at: isCompleted && !wasCompleted 
                ? new Date().toISOString() 
                : state.video_completed_at
        };
    }
};

