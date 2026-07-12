/**
 * Shared constants and helpers for enrollment handlers
 */

import { jsonResponse } from '../../cors.js';
import type { HandlerUserContext } from "../../types/HandlerContext.js";

export const MAX_ACTIVE_ENROLLMENTS = 3;

/**
 * Generate a unique ID for enrollment. Uses `crypto.randomUUID()` for the
 * random suffix (CSPRNG) instead of `Math.random()` — per bearer
 * § insufficiently-random-values, Math.random is predictable enough that
 * an attacker observing one ID can correlate adjacent ones.
 */
export const generateId = () => {
    return `enr_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 9)}`;
};

/**
 * Extract userId from userContext
 */
export const getUserId = (userContext: HandlerUserContext) => {
    return userContext.contact?.id || userContext.employee?.id;
};

export { jsonResponse };
