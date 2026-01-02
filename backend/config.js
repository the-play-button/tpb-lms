/**
 * LMS Configuration
 * 
 * Points are calculated in views (v_leaderboard) and handlers.
 * These values are for reference and used in handlers when awarding XP.
 */

// XP values (must match v_leaderboard view in schema.sql)
export const XP_CONFIG = {
    VIDEO_COMPLETE: 50,      // Video watched to >= 90% completion
    QUIZ_PASS: 100,          // Quiz passed (>= 80% score)
    // Badge XP is defined in gamification_badge.points_reward
};

// Thresholds
export const THRESHOLDS = {
    VIDEO_COMPLETION: 90,    // % to consider video completed
    QUIZ_PASS: 80,           // % to consider quiz passed
    LEVEL_XP: 1000           // XP per level
};
