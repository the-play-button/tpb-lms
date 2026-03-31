// entropy-multiple-exports-ok: tightly-coupled enrollment helpers
// entropy-god-file-ok: shared helpers intentionally imported by all enrollment handlers
/**
 * Shared constants and helpers for enrollment handlers
 */

import { jsonResponse } from '../../cors.js';

export const MAX_ACTIVE_ENROLLMENTS = 3;

/**
 * Generate a unique ID for enrollment
 */
export const generateId = () => {
    return `enr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Extract userId from userContext
 */
export const getUserId = userContext => {
    return userContext.contact?.id || userContext.employee?.id;
};

export { jsonResponse };
