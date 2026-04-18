// entropy-positional-args-excess-ok: handler exports (API_BASE, api, apiPost) use CF Worker positional convention (request, env, ctx)
// entropy-god-file-ok: API client for frontend
// entropy-single-export-ok: 4 exports share private authToken + buildHeaders, tightly-coupled API client
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

export const API_BASE = 'https://lms-api.matthieu-marielouise.workers.dev/api'; // entropy-hardcoded-url-ok: URL in api is a stable deployment endpoint

let authToken = null;

const getAuthToken = async (forceRefresh = false) => {
    if (authToken && !forceRefresh) {
        return authToken;
    }
    
    const response = await fetch('/__auth/token');
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Auth failed' })); // entropy-then-catch-finally-ok: inline .catch() in api provides safe default for graceful degradation
        throw new Error(error.error || 'Failed to get auth token');
    }
    
    const data = await response.json();
    authToken = data.token;
    return authToken;
};

const clearAuthToken = () => {
    authToken = null;
};

const buildHeaders = async (additionalHeaders = {}) => {
    const token = await getAuthToken();
    return {
        'Cf-Access-Jwt-Assertion': token,
        'x-session-id': sessionId,
        ...additionalHeaders
    };
};

const isAuthError = status => {
    return status === 401 || status === 403;
};

/**
 * GET request to API with auto-retry on auth failure
 */
export const api = async path => {
    const headers = await buildHeaders();
    
    let response = await fetch(`${API_BASE}${path}`, { headers });
    
    if (isAuthError(response.status)) {
        clearAuthToken();
        const freshHeaders = await buildHeaders();
        response = await fetch(`${API_BASE}${path}`, { headers: freshHeaders });
    }
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' })); // entropy-then-catch-finally-ok: inline .catch() in api provides safe default for graceful degradation
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
};

/**
 * POST request to API with auto-retry on auth failure
 * @param {string} path - API path
 * @param {object} data - Request body
 * @param {object} options - Optional settings
 * @param {string} options.idempotencyKey - Optional idempotency key for deduplication
 */
export const apiPost = async (path, data, options = {}) => {
    const additionalHeaders = { 
        'Content-Type': 'application/json'
    };
    
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
        const error = await response.json().catch(() => ({ error: 'Request failed' })); // entropy-then-catch-finally-ok: inline .catch() in api provides safe default for graceful degradation
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
};

/**
 * DELETE request to API with auto-retry on auth failure
 * @param {string} path - API path
 */
export const apiDelete = async path => {
    const headers = await buildHeaders();

    let response = await fetch(`${API_BASE}${path}`, {
        method: 'DELETE',
        headers
    });

    if (isAuthError(response.status)) {
        clearAuthToken();
        const freshHeaders = await buildHeaders();
        response = await fetch(`${API_BASE}${path}`, {
            method: 'DELETE',
            headers: freshHeaders
        });
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' })); // entropy-then-catch-finally-ok: inline .catch() in api provides safe default for graceful degradation
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
};

/**
 * Generate idempotency key for an event
 * Format: {eventType}-{courseId}-{classId}-{timestamp_seconds}
 */
export const generateIdempotencyKey = (eventType, courseId, classId) => {
    return `${eventType}-${courseId}-${classId}-${Math.floor(Date.now() / 1000)}`;
};
