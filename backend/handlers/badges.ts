/**
 * Badges Handler
 *
 * Uses gamification_badge and gamification_award (Unified.to extension)
 */

import { jsonResponse } from '../cors.js';
import { listBadgesWithUserStatus } from '../services/badges/BadgesService.js';
import type { Env } from "../types/Env.js";

/**
 * GET /api/badges
 *
 * Returns all badge definitions with user's earned status.
 */
export const listBadges = async (request: Request, env: Env, userContext) => {
    const result = await listBadgesWithUserStatus(env, userContext.contact.id);
    return jsonResponse(result, 200, request);
};
