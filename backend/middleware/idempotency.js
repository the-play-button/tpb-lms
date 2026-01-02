/**
 * Idempotency Middleware
 * 
 * Prevents duplicate event processing from double-clicks or network retries.
 * Uses in-memory cache with TTL.
 * 
 * GAP-711
 */

import { getCorsHeaders } from '../cors.js';

// In-memory cache: Map<idempotencyKey, { response, timestamp }>
const cache = new Map();

// Cache TTL in milliseconds (60 seconds)
const CACHE_TTL = 60000;

// Cleanup interval
const CLEANUP_INTERVAL = 30000;
let lastCleanup = Date.now();

/**
 * Clean up expired cache entries
 */
function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    
    lastCleanup = now;
    const expiry = now - CACHE_TTL;
    
    for (const [key, entry] of cache.entries()) {
        if (entry.timestamp < expiry) {
            cache.delete(key);
        }
    }
}

/**
 * Check if request has already been processed
 * @param {Request} request - The incoming request
 * @returns {Response|null} - Cached response if found, null otherwise
 */
export function checkIdempotency(request) {
    // Run cleanup periodically
    cleanup();
    
    const idempotencyKey = request.headers.get('X-Idempotency-Key');
    
    // No key = no idempotency check
    if (!idempotencyKey) return null;
    
    const cached = cache.get(idempotencyKey);
    
    if (cached) {
        // Check if still valid
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            // Return cached response with CORS + indicator headers
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
            // Expired, remove from cache
            cache.delete(idempotencyKey);
        }
    }
    
    return null; // First request, continue processing
}

/**
 * Cache response for future idempotency checks
 * @param {Request} request - The original request
 * @param {Response} response - The response to cache
 * @returns {Response} - The response with idempotency header
 */
export async function cacheIdempotencyResponse(request, response) {
    const idempotencyKey = request.headers.get('X-Idempotency-Key');
    
    if (!idempotencyKey) return response;
    
    // Clone response to read body
    const cloned = response.clone();
    const body = await cloned.text();
    
    // Store in cache
    cache.set(idempotencyKey, {
        status: response.status,
        body,
        timestamp: Date.now()
    });
    
    // Add header to response
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Idempotency-Key', idempotencyKey);
    
    return newResponse;
}

/**
 * Generate idempotency key for an event
 * (Helper for client-side reference)
 * Format: {eventType}-{courseId}-{classId}-{timestamp_seconds}
 */
export function generateIdempotencyKey(eventType, courseId, classId) {
    const timestamp = Math.floor(Date.now() / 1000);
    return `${eventType}-${courseId}-${classId}-${timestamp}`;
}

