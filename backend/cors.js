/**
 * CORS Configuration + Security Headers
 * GAP-1406: Security headers
 */

export const ALLOWED_ORIGINS = [
    'https://lms-viewer.matthieu-marielouise.workers.dev',  // Frontend (Workers)
    'http://localhost:8080',
    'http://127.0.0.1:8080'
];

// Security headers (GAP-1406)
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

/**
 * Generate CORS headers based on request origin
 * With credentials: 'include', we cannot use '*' for origin
 */
export function getCorsHeaders(request) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Cf-Access-Jwt-Assertion, x-session-id, Authorization, X-Idempotency-Key',
        'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, X-Idempotency-Cached',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
        ...SECURITY_HEADERS
    };
}

/**
 * JSON response with CORS headers
 */
export function jsonResponse(data, status = 200, request = null) {
    const headers = request ? getCorsHeaders(request) : { 'Content-Type': 'application/json' };
    headers['Content-Type'] = 'application/json';
    
    return new Response(JSON.stringify(data), {
        status,
        headers
    });
}

/**
 * Error response helper
 */
export function errorResponse(message, status = 400, request = null) {
    return jsonResponse({ error: message }, status, request);
}

