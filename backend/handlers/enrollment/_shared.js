/**
 * Shared constants and helpers for enrollment handlers
 */

import { jsonResponse } from '../../cors.js';

// Maximum number of active enrollments per user
export const MAX_ACTIVE_ENROLLMENTS = 3;

/**
 * Generate a unique ID for enrollment
 */
export function generateId() {
    return `enr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract userId from userContext
 */
export function getUserId(userContext) {
    return userContext.contact?.id || userContext.employee?.id;
}

export { jsonResponse };
