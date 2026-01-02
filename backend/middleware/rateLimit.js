/**
 * Rate Limiting Middleware
 * 
 * Sliding window in-memory rate limiter.
 * Protects against DDoS and abuse.
 * 
 * GAP-1415
 */

import { getCorsHeaders } from '../cors.js';

// Rate limits per endpoint
const LIMITS = {
    'POST:/api/events': { requests: 60, window: 60 },     // 60 req/min
    'POST:/api/events/batch': { requests: 30, window: 60 }, // 30 req/min
    'POST:/api/quiz': { requests: 20, window: 60 },        // 20 req/min
    'POST:/api/tally-webhook': { requests: 100, window: 60 }, // 100 req/min (webhooks)
    'default': { requests: 100, window: 60 }               // 100 req/min default
};

// In-memory store: Map<ip, Array<timestamp>>
const requestCounts = new Map();

// Cleanup old entries periodically (prevent memory leak)
const CLEANUP_INTERVAL = 60000; // 1 minute
let lastCleanup = Date.now();

/**
 * Clean up expired timestamps
 */
function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    
    lastCleanup = now;
    const expiry = now - 60000; // 60s window
    
    for (const [key, timestamps] of requestCounts.entries()) {
        const valid = timestamps.filter(t => t > expiry);
        if (valid.length === 0) {
            requestCounts.delete(key);
        } else {
            requestCounts.set(key, valid);
        }
    }
}

/**
 * Get rate limit for a specific endpoint
 */
function getLimit(method, path) {
    const key = `${method}:${path}`;
    return LIMITS[key] || LIMITS.default;
}

/**
 * Check rate limit for request
 * @param {Request} request - The incoming request
 * @returns {Response|null} - 429 response if rate limited, null otherwise
 */
export function checkRateLimit(request) {
    // Run cleanup periodically
    cleanup();
    
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // Skip rate limiting for GET requests (read-only)
    if (method === 'GET' || method === 'OPTIONS') {
        return null;
    }
    
    // Get client IP (Cloudflare provides this header)
    const ip = request.headers.get('CF-Connecting-IP') || 
               request.headers.get('X-Forwarded-For')?.split(',')[0] || 
               'unknown';
    
    const limit = getLimit(method, path);
    const now = Date.now();
    const windowStart = now - (limit.window * 1000);
    
    // Get or create timestamp array for this IP
    const key = `${ip}:${method}:${path}`;
    const timestamps = requestCounts.get(key) || [];
    
    // Filter to only timestamps within the window
    const recentTimestamps = timestamps.filter(t => t > windowStart);
    
    // Check if over limit
    if (recentTimestamps.length >= limit.requests) {
        const oldestInWindow = Math.min(...recentTimestamps);
        const retryAfter = Math.ceil((oldestInWindow + (limit.window * 1000) - now) / 1000);
        
        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify({ 
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`
        }), {
            status: 429,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Retry-After': String(Math.max(1, retryAfter)),
                'X-RateLimit-Limit': String(limit.requests),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(Math.ceil((oldestInWindow + (limit.window * 1000)) / 1000))
            }
        });
    }
    
    // Add current timestamp
    recentTimestamps.push(now);
    requestCounts.set(key, recentTimestamps);
    
    return null; // Continue processing
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(response, request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const ip = request.headers.get('CF-Connecting-IP') || 
               request.headers.get('X-Forwarded-For')?.split(',')[0] || 
               'unknown';
    
    const limit = getLimit(method, path);
    const key = `${ip}:${method}:${path}`;
    const timestamps = requestCounts.get(key) || [];
    const windowStart = Date.now() - (limit.window * 1000);
    const recentCount = timestamps.filter(t => t > windowStart).length;
    
    // Clone response to add headers
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-RateLimit-Limit', String(limit.requests));
    newResponse.headers.set('X-RateLimit-Remaining', String(Math.max(0, limit.requests - recentCount)));
    
    return newResponse;
}

