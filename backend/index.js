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
import { listEnrollments, enrollInCourse, abandonCourse, completeCourse, getEnrollmentStatus, updateProgress } from './handlers/enrollment.js';
import { listBadges } from './handlers/badges.js';
import { handleEvent, handleBatchEvents } from './handlers/events.js';
import { getStepSignals, getCourseSignalsHandler, resetCourseSignals } from './handlers/signals.js';
import { handleQuizSubmission, handleTallyWebhook, handleTallyWebhookWithBody, verifyTallySignature } from './handlers/quiz.js';
import { getLearnerProgress } from './handlers/learner.js';
import { getLeaderboard, getUserStats } from './handlers/leaderboard.js';
import { handleTestSeed } from './handlers/test.js';
import { createAPIKeyHandler, listAPIKeysHandler, revokeAPIKeyHandler, adminCreateAPIKeyHandler } from './handlers/apikeys.js';
import { getAdminStats } from './handlers/admin.js';
import { listSpaces, getSpace, getPage } from './handlers/kms.js';
import { getTranslations, upsertTranslation, batchUpsertTranslations, getTranslationsForReview } from './handlers/translations.js';
import { getGlossary, addGlossaryTerm, deleteGlossaryTerm, importGlossaryTerms } from './handlers/glossary.js';
import { getGitHubContent, listGitHubDirectory } from './handlers/content.js';
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
            
            // GitHub content proxy - public for now (DEBUG - token auth issue)
            // TODO: Re-enable auth after fixing vault token scopes
            if (path === '/api/content/github' && request.method === 'GET') {
                return await getGitHubContent(request, env, null);
            }
            
            if (path === '/api/content/github/tree' && request.method === 'GET') {
                return await listGitHubDirectory(request, env, null);
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
            // ENROLLMENTS
            // ------------------------------------------
            if (path === '/api/enrollments' && request.method === 'GET') {
                return await listEnrollments(request, env, userContext);
            }
            
            // PATCH /api/enrollments/:id/progress
            const enrollmentProgressMatch = path.match(/^\/api\/enrollments\/([^/]+)\/progress$/);
            if (enrollmentProgressMatch && request.method === 'PATCH') {
                return await updateProgress(request, env, userContext, enrollmentProgressMatch[1]);
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
            
            // POST /api/courses/:id/enroll
            const enrollMatch = path.match(/^\/api\/courses\/([^/]+)\/enroll$/);
            if (enrollMatch && request.method === 'POST') {
                return await enrollInCourse(request, env, userContext, enrollMatch[1]);
            }
            
            // POST /api/courses/:id/abandon
            const abandonMatch = path.match(/^\/api\/courses\/([^/]+)\/abandon$/);
            if (abandonMatch && request.method === 'POST') {
                return await abandonCourse(request, env, userContext, abandonMatch[1]);
            }
            
            // POST /api/courses/:id/complete
            const completeMatch = path.match(/^\/api\/courses\/([^/]+)\/complete$/);
            if (completeMatch && request.method === 'POST') {
                return await completeCourse(request, env, userContext, completeMatch[1]);
            }
            
            // GET /api/courses/:id/enrollment
            const enrollmentStatusMatch = path.match(/^\/api\/courses\/([^/]+)\/enrollment$/);
            if (enrollmentStatusMatch && request.method === 'GET') {
                return await getEnrollmentStatus(request, env, userContext, enrollmentStatusMatch[1]);
            }
            
            // ------------------------------------------
            // KMS - Knowledge Management System
            // ------------------------------------------
            if (path === '/api/kms/spaces' && request.method === 'GET') {
                return await listSpaces(request, env, userContext);
            }
            
            // GET /api/kms/spaces/:id
            const kmsSpaceMatch = path.match(/^\/api\/kms\/spaces\/([^/]+)$/);
            if (kmsSpaceMatch && request.method === 'GET') {
                return await getSpace(request, env, userContext, kmsSpaceMatch[1]);
            }
            
            // GET /api/kms/pages/:id
            const kmsPageMatch = path.match(/^\/api\/kms\/pages\/([^/]+)$/);
            if (kmsPageMatch && request.method === 'GET') {
                return await getPage(request, env, userContext, kmsPageMatch[1]);
            }
            
            // ------------------------------------------
            // CONTENT - GitHub content proxy
            // (Moved to PUBLIC section - see above)
            // ------------------------------------------
            
            // ------------------------------------------
            // TRANSLATIONS - Multi-language support
            // ------------------------------------------
            // GET /api/translations/review - Get translations needing review
            if (path === '/api/translations/review' && request.method === 'GET') {
                return await getTranslationsForReview(request, env, userContext);
            }
            
            // POST /api/translations/batch - Batch upsert (for AI engine)
            if (path === '/api/translations/batch' && request.method === 'POST') {
                return await batchUpsertTranslations(request, env, userContext);
            }
            
            // GET /api/translations/:type/:id - Get translations for content
            const translationsGetMatch = path.match(/^\/api\/translations\/([^/]+)\/([^/]+)$/);
            if (translationsGetMatch && request.method === 'GET') {
                return await getTranslations(request, env, userContext);
            }
            
            // PUT /api/translations/:type/:id/:lang - Upsert translation
            const translationsPutMatch = path.match(/^\/api\/translations\/([^/]+)\/([^/]+)\/([^/]+)$/);
            if (translationsPutMatch && request.method === 'PUT') {
                return await upsertTranslation(request, env, userContext);
            }
            
            // ------------------------------------------
            // GLOSSARY - Business terminology
            // ------------------------------------------
            // POST /api/glossary/:orgId/import - Batch import terms
            const glossaryImportMatch = path.match(/^\/api\/glossary\/([^/]+)\/import$/);
            if (glossaryImportMatch && request.method === 'POST') {
                return await importGlossaryTerms(request, env, userContext);
            }
            
            // GET /api/glossary/:orgId - Get glossary for org
            const glossaryGetMatch = path.match(/^\/api\/glossary\/([^/]+)$/);
            if (glossaryGetMatch && request.method === 'GET') {
                return await getGlossary(request, env, userContext);
            }
            
            // POST /api/glossary/:orgId - Add term
            if (glossaryGetMatch && request.method === 'POST') {
                return await addGlossaryTerm(request, env, userContext);
            }
            
            // DELETE /api/glossary/:orgId/:termId - Delete term
            const glossaryDeleteMatch = path.match(/^\/api\/glossary\/([^/]+)\/([^/]+)$/);
            if (glossaryDeleteMatch && request.method === 'DELETE') {
                return await deleteGlossaryTerm(request, env, userContext);
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
