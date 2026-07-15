/**
 * CORS Configuration + Security Headers
 * GAP-1406: Security headers
 */

const PRIMARY_ORIGIN = 'https://lms-viewer.matthieu-marielouise.workers.dev';  // Frontend (Workers)

export const ALLOWED_ORIGINS = [
    PRIMARY_ORIGIN,
    'http://localhost:8080',
    'http://127.0.0.1:8080'
];

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
export const getCorsHeaders = (request: Request): {
    'X-Content-Type-Options': string;
    'X-Frame-Options': string;
    'X-XSS-Protection': string;
    'Referrer-Policy': string;
    'Strict-Transport-Security': string;
    'Access-Control-Allow-Origin': string;
    'Access-Control-Allow-Methods': string;
    'Access-Control-Allow-Headers': string;
    'Access-Control-Expose-Headers': string;
    'Access-Control-Allow-Credentials': string;
    'Access-Control-Max-Age': string;
}  => {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : PRIMARY_ORIGIN;
    
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Cf-Access-Jwt-Assertion, x-session-id, Authorization, X-Idempotency-Key',
        'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, X-Idempotency-Cached',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
        ...SECURITY_HEADERS
    };
};

/**
 * JSON response with CORS headers
 */
export const jsonResponse = (
    data: unknown,
    status = 200,
    request: Request | null = null,
): Response => {
    const headers: Record<string, string> = request
        ? getCorsHeaders(request)
        : { 'Content-Type': 'application/json' };
    headers['Content-Type'] = 'application/json';

    return new Response(JSON.stringify(data), {
        status,
        headers,
    });
};

/**
 * Error response helper
 */
export const errorResponse = (
    message: unknown,
    status = 400,
    request: Request | null = null,
): Response => {
    return jsonResponse({ error: message }, status, request);
};

