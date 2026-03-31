/**
 * Idempotency Middleware
 * 
 * Prevents duplicate event processing from double-clicks or network retries.
 * Uses in-memory cache with TTL.
 * 
 * GAP-711
 */

import { getCorsHeaders } from '../cors.js';

const cache = new Map();

const CACHE_TTL = 60000;

const CLEANUP_INTERVAL = 30000;
let lastCleanup = Date.now();

const cleanup = () => {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    
    lastCleanup = now;
    const expiry = now - CACHE_TTL;
    
    for (const [key, entry] of cache.entries()) {
        if (entry.timestamp < expiry) {
            cache.delete(key);
        }
    }
};

/**
 * Check if request has already been processed
 * @param {Request} request - The incoming request
 * @returns {Response|null} - Cached response if found, null otherwise
 */
export const checkIdempotency = request => {
    cleanup();
    
    const idempotencyKey = request.headers.get('X-Idempotency-Key');
    
    if (!idempotencyKey) return null;
    
    const cached = cache.get(idempotencyKey);
    
    if (cached) {
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            const corsHeaders = getCorsHeaders(request);
            const response = new Response(cached.body, {
                status: cached.status,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Cached': 'true',
                    'X-Idempotency-Key': idempotencyKey
                }
            });
            return response;
        } else {
            cache.delete(idempotencyKey);
        }
    }
    
    return null; // First request, continue processing
};

/**
 * Cache response for future idempotency checks
 * @param {Request} request - The original request
 * @param {Response} response - The response to cache
 * @returns {Response} - The response with idempotency header
 */
export const cacheIdempotencyResponse = async (request, response) => {
    const idempotencyKey = request.headers.get('X-Idempotency-Key');
    
    if (!idempotencyKey) return response;
    
    const cloned = response.clone();
    const body = await cloned.text();
    
    cache.set(idempotencyKey, {
        status: response.status,
        body,
        timestamp: Date.now()
    });
    
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Idempotency-Key', idempotencyKey);
    
    return newResponse;
};

/**
 * Generate idempotency key for an event
 * (Helper for client-side reference)
 * Format: {eventType}-{courseId}-{classId}-{timestamp_seconds}
 */
export const generateIdempotencyKey = (eventType, courseId, classId) => {
    const timestamp = Math.floor(Date.now() / 1000);
    return `${eventType}-${courseId}-${classId}-${timestamp}`;
};

