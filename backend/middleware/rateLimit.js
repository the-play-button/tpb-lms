/**
 * Rate Limiting Middleware
 * 
 * Sliding window in-memory rate limiter.
 * Protects against DDoS and abuse.
 * 
 * GAP-1415
 */

import { getCorsHeaders } from '../cors.js';

const LIMITS = {
    'POST:/api/events': { requests: 60, window: 60 },     // 60 req/min (single + bulk)
    'POST:/api/quiz-submissions': { requests: 20, window: 60 }, // 20 req/min
    'POST:/api/tally-webhook': { requests: 100, window: 60 }, // 100 req/min (webhooks)
    'default': { requests: 100, window: 60 }               // 100 req/min default
};

const requestCounts = new Map();

const RATE_LIMIT_CLEANUP_INTERVAL = 60000; // 1 minute
let lastCleanup = Date.now();

const cleanup = () => {
    const now = Date.now();
    if (now - lastCleanup < RATE_LIMIT_CLEANUP_INTERVAL) return;
    
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
};

const getLimit = (method, path) => {
    const key = `${method}:${path}`;
    return LIMITS[key] || LIMITS.default;
};

/**
 * Check rate limit for request
 * @param {Request} request - The incoming request
 * @returns {Response|null} - 429 response if rate limited, null otherwise
 */
export const checkRateLimit = request => {
    cleanup();
    
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    if (method === 'GET' || method === 'OPTIONS') {
        return null;
    }
    
    const ip = request.headers.get('CF-Connecting-IP') || 
               request.headers.get('X-Forwarded-For')?.split(',')[0] || 
               'unknown';
    
    const limit = getLimit(method, path);
    const now = Date.now();
    const windowStart = now - (limit.window * 1000);
    
    const key = `${ip}:${method}:${path}`;

    const recentTimestamps = (requestCounts.get(key) || []).filter(t => t > windowStart);
    
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
    
    recentTimestamps.push(now);
    requestCounts.set(key, recentTimestamps);
    
    return null; // Continue processing
};

