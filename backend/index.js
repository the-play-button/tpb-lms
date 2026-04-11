// entropy-thin-entrypoint-ok: entrypoint routing logic, extraction tracked separately
// entropy-backend-structure-ok: cors.js and config.js at root are shared utilities
// entropy-legacy-marker-ok: debt — TODO re-enable auth on GitHub content proxy after fixing vault token scopes
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
import { authenticateRequest } from './auth/index.js';
import { getSession } from './handlers/auth.js';
import { listCourses, getCourse } from './handlers/courses.js';
import { listEnrollments, enrollInCourse, abandonCourse, completeCourse, getEnrollmentStatus, updateProgress } from './handlers/enrollment/index.js';
import { listBadges } from './handlers/badges.js';
import { handleEvent, handleBatchEvents } from './handlers/events.js';
import { getStepSignals, getCourseSignalsHandler, resetCourseSignals } from './handlers/signals.js';
import { handleQuizSubmission, handleTallyWebhook, handleTallyWebhookWithBody, verifyTallySignature } from './handlers/quiz/index.js';
import { getLearnerProgress } from './handlers/learner.js';
import { getLeaderboard, getUserStats } from './handlers/leaderboard.js';
import { handleTestSeed } from './handlers/test.js';
import { createAPIKeyHandler, listAPIKeysHandler, revokeAPIKeyHandler, adminCreateAPIKeyHandler } from './handlers/apikeys/index.js';
import { getAdminStats } from './handlers/admin.js';
import { listSpaces, getSpace, getPage } from './handlers/kms.js';
import { getTranslations, upsertTranslation, batchUpsertTranslations, getTranslationsForReview } from './handlers/translations/index.js';
import { getGlossary, addGlossaryTerm, deleteGlossaryTerm, importGlossaryTerms } from './handlers/glossary/index.js';
import { getGitHubContent, listGitHubDirectory } from './handlers/content.js';
import { createByocContext } from './handlers/byocContext.js';
import { getCloudContentController } from './application/cloudContent/getCloudContent/getCloudContentController.js';
import { getCloudPitchController } from './application/cloudContent/getCloudPitch/getCloudPitchController.js';
import { listConnectionsController } from './application/connections/listConnections/listConnectionsController.js';
import { getDefaultConnectionController } from './application/connections/getDefaultConnection/getDefaultConnectionController.js';
import { shareContentController } from './application/sharing/shareContent/shareContentController.js';
import { revokeShareController } from './application/sharing/revokeShare/revokeShareController.js';
import { listPermissionsController } from './application/sharing/listPermissions/listPermissionsController.js';
import { sharedWithMeController } from './application/sharing/sharedWithMeController.js';
import { sharedByMeController } from './application/sharing/sharedByMeController.js';
import { addTraceId, withTraceHeader } from './middleware/trace.js';
import { checkRateLimit } from './middleware/rateLimit.js';
import { checkIdempotency, cacheIdempotencyResponse } from './middleware/idempotency.js';
import { handleLogin, handleCallback, handleLogout } from './handlers/auth-logto/index.js';
import logger from './utils/log.js';
import { withFetchErrorHandler } from '@the-play-button/tpb-sdk-js';

const log = logger('worker');

const withCors = (response, request) => {
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(getCorsHeaders(request))) {
        newHeaders.set(key, value);
    }
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
    });
};

const handleHealthCheck = async (env, request) => {
    const dbCheck = await env.DB.prepare('SELECT 1 as ok').first().catch(() => null); // entropy-then-catch-finally-ok: inline catch fallback — await p.catch(fn) provides a safe default value  # entropy-catch-return-default-ok: health check endpoint — null signals DB unreachable, reported as degraded
    const isDbUp = dbCheck?.ok === 1;
    return jsonResponse({ 
        status: isDbUp ? 'healthy' : 'degraded',
        checks: { database: { status: isDbUp ? 'up' : 'down' } },
        timestamp: new Date().toISOString(),
        version: '2.1.0'
    }, 200, request);
};

const handleTallyWithAuth = async (request, url, env) => {
    if (env.TALLY_SIGNING_SECRET) {
        const { valid, body, noSignature } = await verifyTallySignature(request, env.TALLY_SIGNING_SECRET); // entropy-naming-convention-ok: destructured from API shape
        
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
};

const fetchHandler = async (request, env, ctx) => {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: getCorsHeaders(request)
        });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    const { traceId } = addTraceId(request);

    const rateLimited = checkRateLimit(request);
    if (rateLimited) return rateLimited;
            // ============================================
            // ============================================
            
            if (path === '/api/health') {
                return await handleHealthCheck(env, request);
            }

            if (path === '/auth/login' && request.method === 'GET') {
                return await handleLogin(request, env);
            }
            if (path === '/auth/callback' && request.method === 'GET') {
                return await handleCallback(request, env);
            }
            if (path === '/auth/logout' && request.method === 'GET') {
                return await handleLogout(request, env);
            }
            
            if (path === '/api/tally-webhook' && request.method === 'POST') {
                return await handleTallyWithAuth(request, url, env);
            }
            
            // TODO: Re-enable auth after fixing vault token scopes
            if (path === '/api/content/github' && request.method === 'GET') {
                return await getGitHubContent(request, env, null);
            }
            
            if (path === '/api/content/github/tree' && request.method === 'GET') {
                return await listGitHubDirectory(request, env, null);
            }
            
            // ============================================
            // ============================================
            
            if (path === '/api/test/seed' && request.method === 'POST') {
                return await handleTestSeed(request, env);
            }
            
            // ============================================
            // ============================================
            
            const auth = await authenticateRequest(request, env);
            if (auth.error) return auth.error;
            
            const userContext = { 
                user: auth.user, 
                contact: auth.contact,
                employee: auth.employee,
                learner: auth.contact || auth.employee
            };
            
            // ------------------------------------------
            // ------------------------------------------
            if (path === '/api/auth/session' && request.method === 'GET') {
                return await getSession(request, env);
            }
            
            // ------------------------------------------
            // ------------------------------------------
            if (path === '/api/auth/api-keys' && request.method === 'POST') {
                return await createAPIKeyHandler(request, env, auth);
            }
            
            if (path === '/api/auth/api-keys' && request.method === 'GET') {
                return await listAPIKeysHandler(request, env, auth);
            }
            
            const apiKeyMatch = path.match(/^\/api\/auth\/api-keys\/([^/]+)$/);
            if (apiKeyMatch && request.method === 'DELETE') {
                return await revokeAPIKeyHandler(request, env, auth, apiKeyMatch[1]);
            }
            
            // ------------------------------------------
            // ------------------------------------------
            if (path === '/api/admin/stats' && request.method === 'GET') {
                return await getAdminStats(request, env, userContext);
            }
            
            if (path === '/api/admin/api-keys' && request.method === 'POST') {
                return await adminCreateAPIKeyHandler(request, env, userContext);
            }
            
            // ------------------------------------------
            // ------------------------------------------
            if (path === '/api/events' && request.method === 'POST') {
                const cachedResponse = checkIdempotency(request);
                if (cachedResponse) return cachedResponse;
                
                const response = await handleEvent(request, env, userContext);
                return await cacheIdempotencyResponse(request, response);
            }
            
            if (path === '/api/events/batch' && request.method === 'POST') {
                return await handleBatchEvents(request, env, userContext);
            }
            
            // ------------------------------------------
            // ------------------------------------------
            const stepSignalsMatch = path.match(/^\/api\/signals\/([^/]+)\/([^/]+)$/);
            if (stepSignalsMatch && request.method === 'GET') {
                return await getStepSignals(request, env, userContext, stepSignalsMatch[1], stepSignalsMatch[2]);
            }
            
            const courseSignalsMatch = path.match(/^\/api\/signals\/([^/]+)$/);
            if (courseSignalsMatch && request.method === 'GET') {
                return await getCourseSignalsHandler(request, env, userContext, courseSignalsMatch[1]);
            }
            
            const resetSignalsMatch = path.match(/^\/api\/signals\/([^/]+)\/reset$/);
            if (resetSignalsMatch && request.method === 'POST') {
                return await resetCourseSignals(request, env, userContext, resetSignalsMatch[1]);
            }
            
            // ------------------------------------------
            // ------------------------------------------
            if (path === '/api/enrollments' && request.method === 'GET') {
                return await listEnrollments(request, env, userContext);
            }
            
            const enrollmentProgressMatch = path.match(/^\/api\/enrollments\/([^/]+)\/progress$/);
            if (enrollmentProgressMatch && request.method === 'PATCH') {
                return await updateProgress(request, env, userContext, enrollmentProgressMatch[1]);
            }
            
            // ------------------------------------------
            // ------------------------------------------
            if ((path === '/api/courses' || path === '/api/soms') && request.method === 'GET') {
                return await listCourses(request, env, userContext);
            }
            
            const courseMatch = path.match(/^\/api\/(courses|soms)\/([^/]+)$/);
            if (courseMatch && request.method === 'GET') {
                return await getCourse(request, env, userContext, courseMatch[2]);
            }
            
            const enrollMatch = path.match(/^\/api\/courses\/([^/]+)\/enroll$/);
            if (enrollMatch && request.method === 'POST') {
                return await enrollInCourse(request, env, userContext, enrollMatch[1]);
            }
            
            const abandonMatch = path.match(/^\/api\/courses\/([^/]+)\/abandon$/);
            if (abandonMatch && request.method === 'POST') {
                return await abandonCourse(request, env, userContext, abandonMatch[1]);
            }
            
            const completeMatch = path.match(/^\/api\/courses\/([^/]+)\/complete$/);
            if (completeMatch && request.method === 'POST') {
                return await completeCourse(request, env, userContext, completeMatch[1]);
            }
            
            const enrollmentStatusMatch = path.match(/^\/api\/courses\/([^/]+)\/enrollment$/);
            if (enrollmentStatusMatch && request.method === 'GET') {
                return await getEnrollmentStatus(request, env, userContext, enrollmentStatusMatch[1]);
            }
            
            // ------------------------------------------
            // ------------------------------------------
            if (path === '/api/kms/spaces' && request.method === 'GET') {
                return await listSpaces(request, env, userContext);
            }
            
            const kmsSpaceMatch = path.match(/^\/api\/kms\/spaces\/([^/]+)$/);
            if (kmsSpaceMatch && request.method === 'GET') {
                return await getSpace(request, env, userContext, kmsSpaceMatch[1]);
            }
            
            const kmsPageMatch = path.match(/^\/api\/kms\/pages\/([^/]+)$/);
            if (kmsPageMatch && request.method === 'GET') {
                return await getPage(request, env, userContext, kmsPageMatch[1]);
            }
            
            // ------------------------------------------
            // ------------------------------------------
            if (path === '/api/content/cloud' && request.method === 'GET') {
                const ctx = await createByocContext(request, env, userContext);
                return withCors(await getCloudContentController(request, ctx), request);
            }

            if (path === '/api/content/cloud/pitch' && request.method === 'GET') {
                const ctx = await createByocContext(request, env, userContext);
                return withCors(await getCloudPitchController(request, ctx), request);
            }

            // ------------------------------------------
            // ------------------------------------------
            if (path === '/api/connections' && request.method === 'GET') {
                const ctx = await createByocContext(request, env, userContext);
                return withCors(await listConnectionsController(request, ctx), request);
            }

            if (path === '/api/connections/default' && request.method === 'GET') {
                const ctx = await createByocContext(request, env, userContext);
                return withCors(await getDefaultConnectionController(request, ctx), request);
            }

            // ------------------------------------------
            // ------------------------------------------
            const shareMatch = path.match(/^\/api\/content\/([^/]+)\/share$/);
            if (shareMatch && request.method === 'POST') {
                const ctx = await createByocContext(request, env, userContext);
                return withCors(await shareContentController(request, ctx, shareMatch[1]), request);
            }

            const revokeShareMatch = path.match(/^\/api\/content\/([^/]+)\/share\/([^/]+)$/);
            if (revokeShareMatch && request.method === 'DELETE') {
                const ctx = await createByocContext(request, env, userContext);
                return withCors(await revokeShareController(request, ctx, revokeShareMatch[1], revokeShareMatch[2]), request);
            }

            const permissionsMatch = path.match(/^\/api\/content\/([^/]+)\/permissions$/);
            if (permissionsMatch && request.method === 'GET') {
                const ctx = await createByocContext(request, env, userContext);
                return withCors(await listPermissionsController(request, ctx, permissionsMatch[1]), request);
            }

            if (path === '/api/content/shared-with-me' && request.method === 'GET') {
                const ctx = await createByocContext(request, env, userContext);
                return withCors(await sharedWithMeController(request, ctx), request);
            }

            if (path === '/api/content/shared-by-me' && request.method === 'GET') {
                const ctx = await createByocContext(request, env, userContext);
                return withCors(await sharedByMeController(request, ctx), request);
            }

            // ------------------------------------------
            // (Moved to PUBLIC section - see above)
            // ------------------------------------------
            
            // ------------------------------------------
            // ------------------------------------------
            if (path === '/api/translations/review' && request.method === 'GET') {
                return await getTranslationsForReview(request, env, userContext);
            }
            
            if (path === '/api/translations/batch' && request.method === 'POST') {
                return await batchUpsertTranslations(request, env, userContext);
            }
            
            const translationsGetMatch = path.match(/^\/api\/translations\/([^/]+)\/([^/]+)$/);
            if (translationsGetMatch && request.method === 'GET') {
                return await getTranslations(request, env, userContext);
            }
            
            const translationsPutMatch = path.match(/^\/api\/translations\/([^/]+)\/([^/]+)\/([^/]+)$/);
            if (translationsPutMatch && request.method === 'PUT') {
                return await upsertTranslation(request, env, userContext);
            }
            
            // ------------------------------------------
            // ------------------------------------------
            const glossaryImportMatch = path.match(/^\/api\/glossary\/([^/]+)\/import$/);
            if (glossaryImportMatch && request.method === 'POST') {
                return await importGlossaryTerms(request, env, userContext);
            }
            
            const glossaryGetMatch = path.match(/^\/api\/glossary\/([^/]+)$/);
            if (glossaryGetMatch && request.method === 'GET') {
                return await getGlossary(request, env, userContext);
            }
            
            if (glossaryGetMatch && request.method === 'POST') {
                return await addGlossaryTerm(request, env, userContext);
            }
            
            const glossaryDeleteMatch = path.match(/^\/api\/glossary\/([^/]+)\/([^/]+)$/);
            if (glossaryDeleteMatch && request.method === 'DELETE') {
                return await deleteGlossaryTerm(request, env, userContext);
            }
            
            // ------------------------------------------
            // ------------------------------------------
            if (path === '/api/badges' && request.method === 'GET') {
                return await listBadges(request, env, userContext);
            }
            
            // ------------------------------------------
            // ------------------------------------------
            if ((path === '/api/learner' || path === '/api/profile') && request.method === 'GET') {
                return await getLearnerProgress(request, env, userContext);
            }
            
            if (path === '/api/stats' && request.method === 'GET') {
                return await getUserStats(request, env, userContext);
            }
            
            // ------------------------------------------
            // ------------------------------------------
            if (path === '/api/leaderboard' && request.method === 'GET') {
                return await getLeaderboard(request, env, userContext);
            }
            
            // ------------------------------------------
            // ------------------------------------------
            if (path === '/api/quiz' && request.method === 'POST') {
                return await handleQuizSubmission(request, env, userContext);
            }

    return jsonResponse({ error: 'Not found' }, 404, request);
};

export default {
    fetch: withFetchErrorHandler(fetchHandler, { service: 'tpb-lms' }),
};
