/**
 * Authentication Handler
 * 
 * Handles user session via Cloudflare Access JWT.
 * Refactored for reduced complexity with parallel fetches.
 */

import { jsonResponse } from '../cors.js';
import { verifyAccessJWT, getOrCreateContact } from '../auth.js';
import { getCurrentStreak } from '../helpers/xp.js';

// ============================================
// Helper functions
// ============================================

/**
 * Validate JWT and return error response if invalid
 */
async function validateJWT(jwt, env, request) {
    if (!jwt) {
        return { error: jsonResponse({ 
            error: 'Not authenticated',
            message: 'No Access JWT found. Ensure the API is protected by Cloudflare Access.'
        }, 401, request) };
    }
    
    const result = await verifyAccessJWT(jwt, env);
    
    if (!result.valid) {
        return { error: jsonResponse({ 
            error: 'Authentication failed',
            message: result.error
        }, 403, request) };
    }
    
    return { result };
}

/**
 * Fetch all user data in parallel
 */
async function fetchUserData(db, contactId) {
    const [stats, badges, recentActivity, currentStreak] = await Promise.all([
        db.prepare(`SELECT * FROM v_leaderboard WHERE user_id = ?`).bind(contactId).first(),
        db.prepare(`
            SELECT b.id, b.name, b.description, b.icon_url, b.points_reward, b.rarity, b.type, a.awarded_at
            FROM gamification_award a JOIN gamification_badge b ON b.id = a.badge_id
            WHERE a.user_id = ? ORDER BY a.awarded_at DESC
        `).bind(contactId).all(),
        db.prepare(`
            SELECT id, type, created_at,
                CASE WHEN type = 'VIDEO_VIEW' THEN json_extract(page_view_json, '$.video_id')
                     WHEN type = 'FORM' THEN json_extract(form_json, '$.quiz_id')
                     WHEN type = 'BADGE_EARNED' THEN json_extract(raw_json, '$.badge_id')
                END as target_id,
                CASE WHEN type = 'VIDEO_VIEW' THEN 50
                     WHEN type = 'FORM' AND json_extract(form_json, '$.passed') = 1 THEN 100
                     ELSE 0
                END as points
            FROM crm_event WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
        `).bind(contactId).all(),
        getCurrentStreak(db, contactId)
    ]);
    
    return { stats, badges: badges.results || [], recentActivity: recentActivity.results || [], currentStreak };
}

/**
 * Build session response
 */
function buildSessionResponse(jwtResult, contact, userData) {
    const totalPoints = userData.stats?.total_points || 0;
    
    return {
        user: {
            email: jwtResult.email,
            name: jwtResult.payload?.name || contact.name || null,
            groups: jwtResult.payload?.groups || []
        },
        profile: {
            id: contact.id,
            total_points: totalPoints,
            level: Math.floor(totalPoints / 1000) + 1,
            videos_completed: userData.stats?.videos_completed || 0,
            quizzes_completed: userData.stats?.quizzes_completed || 0,
            badges_earned: userData.stats?.badges_earned || 0,
            current_streak: userData.currentStreak,
            created_at: contact.created_at
        },
        badges: userData.badges,
        recentActivity: userData.recentActivity
    };
}

// ============================================
// Main handler
// ============================================

/**
 * GET /api/auth/session
 */
export async function getSession(request, env) {
    const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
    
    // Validate JWT
    const validation = await validateJWT(jwt, env, request);
    if (validation.error) return validation.error;
    
    // Get or create contact
    const contact = await getOrCreateContact(validation.result.email, env);
    
    // Fetch all user data in parallel
    const userData = await fetchUserData(env.DB, contact.id);
    
    // Build and return response
    return jsonResponse(buildSessionResponse(validation.result, contact, userData), 200, request);
}
