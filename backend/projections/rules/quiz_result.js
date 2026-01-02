/**
 * Quiz Result Projection
 * 
 * QUIZ_SUBMIT events → v_user_progress.quiz_*
 * 
 * Simple logic: store score, mark passed at 80%
 */

export const QUIZ_RESULT_PROJECTION = {
    name: 'quiz_result',
    eventTypes: ['QUIZ_SUBMIT'],
    
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
        const score = payload.score || 0;
        const maxScore = payload.max_score || 1;
        const percentage = Math.round((score / maxScore) * 100);
        
        // Pass at 80%
        const wasPassed = state.quiz_passed === 1;
        const isPassed = percentage >= 80;
        
        return {
            ...state,
            quiz_passed: isPassed ? 1 : 0,
            quiz_score: score,
            quiz_max_score: maxScore,
            // Only set passed_at on first pass
            quiz_passed_at: isPassed && !wasPassed 
                ? new Date().toISOString() 
                : state.quiz_passed_at
        };
    }
};

