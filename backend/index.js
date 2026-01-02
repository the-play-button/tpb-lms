/**
 * LMS Worker API - Entry Point
 * 
 * Event-Based Architecture:
 * - lms_event for raw facts (VIDEO_PING, QUIZ_SUBMIT)
 * - lms_signal for derived state (VIDEO_COMPLETED, QUIZ_PASSED, STEP_COMPLETED)
 * - Projections transform events -> signals
 * 
 * Unified.to aligned schema:
 * - crm_contact for external users
 * - hris_employee for internal users
 * - lms_course, lms_class for content
 * - gamification_badge, gamification_award for badges
 * 
 * Deploy with: wrangler deploy
 */

import { getCorsHeaders, jsonResponse } from './cors.js';
import { authenticateRequest } from './auth.js';
import { getSession } from './handlers/auth.js';
import { listCourses, getCourse } from './handlers/courses.js';
import { listBadges } from './handlers/badges.js';
import { handleEvent, handleBatchEvents } from './handlers/events.js';
import { getStepSignals, getCourseSignalsHandler, resetCourseSignals } from './handlers/signals.js';
import { handleQuizSubmission, handleTallyWebhook, handleTallyWebhookWithBody, verifyTallySignature } from './handlers/quiz.js';
import { getLearnerProgress } from './handlers/learner.js';
import { getLeaderboard, getUserStats } from './handlers/leaderboard.js';
import { handleTestSeed } from './handlers/test.js';
import { createAPIKeyHandler, listAPIKeysHandler, revokeAPIKeyHandler, adminCreateAPIKeyHandler } from './handlers/apikeys.js';
import { getAdminStats } from './handlers/admin.js';
import { addTraceId, withTraceHeader } from './middleware/trace.js';
import { checkRateLimit } from './middleware/rateLimit.js';
import { checkIdempotency, cacheIdempotencyResponse } from './middleware/idempotency.js';
import logger from './utils/log.js';

const log = logger('worker');

/**
 * Handle health check endpoint
 */
async function handleHealthCheck(env, request) {
    const dbCheck = await env.DB.prepare('SELECT 1 as ok').first().catch(() => null);
    const isDbUp = dbCheck?.ok === 1;
    return jsonResponse({ 
        status: isDbUp ? 'healthy' : 'degraded',
        checks: { database: { status: isDbUp ? 'up' : 'down' } },
        timestamp: new Date().toISOString(),
        version: '2.1.0'
    }, 200, request);
}

/**
 * Handle Tally webhook with signature or secret validation
 */
async function handleTallyWithAuth(request, url, env) {
    if (env.TALLY_SIGNING_SECRET) {
        const { valid, body, noSignature } = await verifyTallySignature(request, env.TALLY_SIGNING_SECRET);
        
        if (noSignature) {
            const webhookSecret = url.searchParams.get('secret');
            const secretValid = env.TALLY_WEBHOOK_SECRET && webhookSecret === env.TALLY_WEBHOOK_SECRET;
            if (!secretValid) return jsonResponse({ error: 'Invalid webhook: no signature and invalid secret' }, 403, request);
            return await handleTallyWebhookWithBody(body, env, request);
        }
        
        if (!valid) return jsonResponse({ error: 'Invalid Tally signature' }, 403, request);
        return await handleTallyWebhookWithBody(body, env, request);
    }
    
    const webhookSecret = url.searchParams.get('secret');
    const secretValid = env.TALLY_WEBHOOK_SECRET && webhookSecret === env.TALLY_WEBHOOK_SECRET;
    if (!secretValid) return jsonResponse({ error: 'Invalid webhook secret' }, 403, request);
    return await handleTallyWebhook(request, env);
}

export default {
    async fetch(request, env, ctx) {
        // CORS preflight - respond with 204 and all CORS headers
        if (request.method === 'OPTIONS') {
            return new Response(null, { 
                status: 204,
                headers: getCorsHeaders(request) 
            });
        }

        const url = new URL(request.url);
        const path = url.pathname;
        
        // Add trace ID for request correlation (GAP-1106)
        const { traceId } = addTraceId(request);
        
        // Rate limiting check (GAP-1415)
        const rateLimited = checkRateLimit(request);
        if (rateLimited) return rateLimited;

        try {
            // ============================================
            // PUBLIC ENDPOINTS (no auth required)
            // ============================================
            
            if (path === '/api/health') {
                return await handleHealthCheck(env, request);
            }
            
            // Tally webhook - uses extracted auth logic
            if (path === '/api/tally-webhook' && request.method === 'POST') {
                return await handleTallyWithAuth(request, url, env);
            }
            
            // ============================================
            // TEST ENDPOINTS (secret protected, no JWT)
            // ============================================
            
            if (path === '/api/test/seed' && request.method === 'POST') {
                return await handleTestSeed(request, env);
            }
            
            // ============================================
            // PROTECTED ENDPOINTS (JWT auth required)
            // ============================================
            
            // Authenticate via Cloudflare Access JWT
            const auth = await authenticateRequest(request, env);
            if (auth.error) return auth.error;
            
            const userContext = { 
                user: auth.user, 
                contact: auth.contact,
                employee: auth.employee,
                // Backward compatibility
                learner: auth.contact || auth.employee
            };
            
            // ------------------------------------------
            // AUTH - Session endpoint
            // ------------------------------------------
            if (path === '/api/auth/session' && request.method === 'GET') {
                return await getSession(request, env);
            }
            
            // ------------------------------------------
            // API KEYS - Management endpoints
            // ------------------------------------------
            if (path === '/api/auth/api-keys' && request.method === 'POST') {
                return await createAPIKeyHandler(request, env, auth);
            }
            
            if (path === '/api/auth/api-keys' && request.method === 'GET') {
                return await listAPIKeysHandler(request, env, auth);
            }
            
            // DELETE /api/auth/api-keys/:id
            const apiKeyMatch = path.match(/^\/api\/auth\/api-keys\/([^/]+)$/);
            if (apiKeyMatch && request.method === 'DELETE') {
                return await revokeAPIKeyHandler(request, env, auth, apiKeyMatch[1]);
            }
            
            // ------------------------------------------
            // ADMIN - Statistics and management
            // ------------------------------------------
            if (path === '/api/admin/stats' && request.method === 'GET') {
                return await getAdminStats(request, env, userContext);
            }
            
            // Admin API Key creation for other users
            if (path === '/api/admin/api-keys' && request.method === 'POST') {
                return await adminCreateAPIKeyHandler(request, env, userContext);
            }
            
            // ------------------------------------------
            // EVENTS - Raw fact ingestion
            // ------------------------------------------
            if (path === '/api/events' && request.method === 'POST') {
                // Check idempotency first (GAP-711)
                const cachedResponse = checkIdempotency(request);
                if (cachedResponse) return cachedResponse;
                
                const response = await handleEvent(request, env, userContext);
                return await cacheIdempotencyResponse(request, response);
            }
            
            if (path === '/api/events/batch' && request.method === 'POST') {
                return await handleBatchEvents(request, env, userContext);
            }
            
            // ------------------------------------------
            // SIGNALS - Derived state queries
            // ------------------------------------------
            // GET /api/signals/:courseId/:classId
            const stepSignalsMatch = path.match(/^\/api\/signals\/([^/]+)\/([^/]+)$/);
            if (stepSignalsMatch && request.method === 'GET') {
                return await getStepSignals(request, env, userContext, stepSignalsMatch[1], stepSignalsMatch[2]);
            }
            
            // GET /api/signals/:courseId
            const courseSignalsMatch = path.match(/^\/api\/signals\/([^/]+)$/);
            if (courseSignalsMatch && request.method === 'GET') {
                return await getCourseSignalsHandler(request, env, userContext, courseSignalsMatch[1]);
            }
            
            // POST /api/signals/:courseId/reset
            const resetSignalsMatch = path.match(/^\/api\/signals\/([^/]+)\/reset$/);
            if (resetSignalsMatch && request.method === 'POST') {
                return await resetCourseSignals(request, env, userContext, resetSignalsMatch[1]);
            }
            
            // ------------------------------------------
            // COURSES (formerly SOMs)
            // ------------------------------------------
            if ((path === '/api/courses' || path === '/api/soms') && request.method === 'GET') {
                return await listCourses(request, env, userContext);
            }
            
            // Match /api/courses/:id or /api/soms/:id
            const courseMatch = path.match(/^\/api\/(courses|soms)\/([^/]+)$/);
            if (courseMatch && request.method === 'GET') {
                return await getCourse(request, env, userContext, courseMatch[2]);
            }
            
            // ------------------------------------------
            // BADGES
            // ------------------------------------------
            if (path === '/api/badges' && request.method === 'GET') {
                return await listBadges(request, env, userContext);
            }
            
            // ------------------------------------------
            // LEARNER / PROFILE / STATS
            // ------------------------------------------
            if ((path === '/api/learner' || path === '/api/profile') && request.method === 'GET') {
                return await getLearnerProgress(request, env, userContext);
            }
            
            if (path === '/api/stats' && request.method === 'GET') {
                return await getUserStats(request, env, userContext);
            }
            
            // ------------------------------------------
            // LEADERBOARD
            // ------------------------------------------
            if (path === '/api/leaderboard' && request.method === 'GET') {
                return await getLeaderboard(request, env, userContext);
            }
            
            // ------------------------------------------
            // QUIZ ENDPOINT
            // ------------------------------------------
            if (path === '/api/quiz' && request.method === 'POST') {
                return await handleQuizSubmission(request, env, userContext);
            }

            return jsonResponse({ error: 'Not found' }, 404, request);

        } catch (error) {
            log.error('Worker error', { error, traceId, path });
            const response = jsonResponse({ error: error.message, traceId }, 500, request);
            return withTraceHeader(response, traceId);
        }
    }
};
