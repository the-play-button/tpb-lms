// entropy-single-export-ok: config constants
// entropy-backend-structure-ok: shared config at backend root
/**
 * LMS Configuration
 * 
 * Points are calculated in views (v_leaderboard) and handlers.
 * These values are for reference and used in handlers when awarding XP.
 */

export const XP_CONFIG = {
    VIDEO_COMPLETE: 50,      // Video watched to >= 90% completion
    QUIZ_PASS: 100,          // Quiz passed (>= 80% score)
};

export const THRESHOLDS = {
    VIDEO_COMPLETION: 90,    // % to consider video completed
    QUIZ_PASS: 80,           // % to consider quiz passed
    LEVEL_XP: 1000           // XP per level
};
