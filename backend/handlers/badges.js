/**
 * Badges Handler
 * 
 * Uses gamification_badge and gamification_award (Unified.to extension)
 */

import { jsonResponse } from '../cors.js';

/**
 * GET /api/badges
 * 
 * Returns all badge definitions with user's earned status.
 */
export async function listBadges(request, env, userContext) {
    // Get all active badge definitions
    const badges = await env.DB.prepare(`
        SELECT id, name, description, icon_url, type, category, rarity, points_reward, criteria_json
        FROM gamification_badge
        WHERE is_active = 1
        ORDER BY 
            CASE rarity 
                WHEN 'COMMON' THEN 1 
                WHEN 'RARE' THEN 2 
                WHEN 'EPIC' THEN 3 
                WHEN 'LEGENDARY' THEN 4 
            END,
            name ASC
    `).all();
    
    // Get user's earned badges
    const earned = await env.DB.prepare(`
        SELECT badge_id, awarded_at
        FROM gamification_award
        WHERE user_id = ?
    `).bind(userContext.contact.id).all();
    
    const earnedMap = {};
    for (const e of earned.results || []) {
        earnedMap[e.badge_id] = e.awarded_at;
    }
    
    // Enrich badges with earned status
    const enrichedBadges = (badges.results || []).map(badge => ({
        ...badge,
        criteria: badge.criteria_json ? JSON.parse(badge.criteria_json) : null,
        earned: !!earnedMap[badge.id],
        earned_at: earnedMap[badge.id] || null
    }));
    
    return jsonResponse({ 
        badges: enrichedBadges,
        earnedCount: earned.results?.length || 0,
        totalCount: badges.results?.length || 0
    }, 200, request);
}
