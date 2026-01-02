/**
 * API Client
 * 
 * Fetches JWT from frontend Worker and sends it explicitly in headers.
 * This solves Safari ITP blocking cross-origin cookies.
 * 
 * Auth flow:
 * 1. GET /__auth/token → get JWT from CF Access
 * 2. Send JWT in Cf-Access-Jwt-Assertion header for all API calls
 * 3. Retry once if 401/403 (token expired)
 * 
 * NOTE: Toast uses window.showToast (not ES module export)
 * Pattern: components/*.js attach to window, app/*.js use ES imports
 */

import { sessionId } from './state.js';

// API endpoint
export const API_BASE = 'https://lms-api.matthieu-marielouise.workers.dev/api';

// Cached auth token
let authToken = null;

/**
 * Fetch auth token from frontend Worker
 * The Worker extracts the Cf-Access-Jwt-Assertion header set by CF Access
 */
async function getAuthToken(forceRefresh = false) {
    if (authToken && !forceRefresh) {
        return authToken;
    }
    
    const response = await fetch('/__auth/token');
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Auth failed' }));
        throw new Error(error.error || 'Failed to get auth token');
    }
    
    const data = await response.json();
    authToken = data.token;
    return authToken;
}

/**
 * Clear cached token (force refresh on next request)
 */
function clearAuthToken() {
    authToken = null;
}

/**
 * Build headers with JWT token
 */
async function buildHeaders(additionalHeaders = {}) {
    const token = await getAuthToken();
    return {
        'Cf-Access-Jwt-Assertion': token,
        'x-session-id': sessionId,
        ...additionalHeaders
    };
}

/**
 * Check if error is auth-related (should retry with fresh token)
 */
function isAuthError(status) {
    return status === 401 || status === 403;
}

/**
 * GET request to API with auto-retry on auth failure
 */
export async function api(path) {
    const headers = await buildHeaders();
    
    let response = await fetch(`${API_BASE}${path}`, { headers });
    
    // Retry once with fresh token if auth failed
    if (isAuthError(response.status)) {
        clearAuthToken();
        const freshHeaders = await buildHeaders();
        response = await fetch(`${API_BASE}${path}`, { headers: freshHeaders });
    }
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
}

/**
 * POST request to API with auto-retry on auth failure
 * @param {string} path - API path
 * @param {object} data - Request body
 * @param {object} options - Optional settings
 * @param {string} options.idempotencyKey - Optional idempotency key for deduplication
 */
export async function apiPost(path, data, options = {}) {
    const additionalHeaders = { 
        'Content-Type': 'application/json'
    };
    
    // Add idempotency key if provided (GAP-711)
    if (options.idempotencyKey) {
        additionalHeaders['X-Idempotency-Key'] = options.idempotencyKey;
    }
    
    const headers = await buildHeaders(additionalHeaders);
    const body = JSON.stringify(data);
    
    let response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers,
        body
    });
    
    // Retry once with fresh token if auth failed
    if (isAuthError(response.status)) {
        clearAuthToken();
        const freshHeaders = await buildHeaders(additionalHeaders);
        response = await fetch(`${API_BASE}${path}`, {
            method: 'POST',
            headers: freshHeaders,
            body
        });
    }
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
}

/**
 * Generate idempotency key for an event
 * Format: {eventType}-{courseId}-{classId}-{timestamp_seconds}
 */
export function generateIdempotencyKey(eventType, courseId, classId) {
    const timestamp = Math.floor(Date.now() / 1000);
    return `${eventType}-${courseId}-${classId}-${timestamp}`;
}
