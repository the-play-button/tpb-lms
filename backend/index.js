// entropy-thin-entrypoint-ok: Hono app with data-driven route registration
/**
 * LMS Worker API - Entry Point (Hono)
 *
 * Event-Based Architecture:
 * - lms_event for raw facts (VIDEO_PING, QUIZ_SUBMIT)
 * - lms_signal for derived state (VIDEO_COMPLETED, QUIZ_PASSED, STEP_COMPLETED)
 *
 * Unified.to aligned schema:
 * - crm_contact / hris_employee / lms_course / gamification_badge
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ALLOWED_ORIGINS, jsonResponse } from './cors.js';
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
import { checkRateLimit } from './middleware/rateLimit.js';
import { checkIdempotency, cacheIdempotencyResponse } from './middleware/idempotency.js';
import { handleLogin, handleCallback, handleLogout } from './handlers/auth-logto/index.js';

// --- Hono app ---

const app = new Hono();

// CORS — LMS-specific origins (credentials required for CF Access cookies)
app.use('/*', cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  allowHeaders: ['Content-Type', 'Cf-Access-Jwt-Assertion', 'x-session-id', 'Authorization', 'X-Idempotency-Key'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-Idempotency-Cached'],
  maxAge: 86400,
}));

// Security headers
app.use('/*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});

// Error handler
app.onError((err, c) => {
  console.error(`[tpb-lms] Unhandled error: ${err.message}`, err.stack);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// Health
app.get('/health', (c) => c.json({ status: 'ok', service: 'tpb-lms' }));
app.get('/api/health', async (c) => {
  const dbCheck = await c.env.DB.prepare('SELECT 1 as ok').first().catch(() => null); // entropy-then-catch-finally-ok: health check — null signals DB unreachable
  const isDbUp = dbCheck?.ok === 1;
  return c.json({
    status: isDbUp ? 'healthy' : 'degraded',
    checks: { database: { status: isDbUp ? 'up' : 'down' } },
    timestamp: new Date().toISOString(),
    version: '2.1.0',
  });
});

// Rate limiting (POST/PUT/PATCH/DELETE only, GET/OPTIONS pass through inside checkRateLimit)
app.use('/api/*', async (c, next) => {
  const rateLimited = checkRateLimit(c.req.raw);
  if (rateLimited) return rateLimited;
  await next();
});

// --- Tally webhook auth (signature-based, not session-based) ---
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

// --- Public routes (no session auth) ---

const PUBLIC_API_PATHS = ['/api/health', '/api/tally-webhook', '/api/content/github', '/api/test/seed'];

const publicRoutes = [
  { method: 'GET', path: '/auth/login', handler: handleLogin },
  { method: 'GET', path: '/auth/callback', handler: handleCallback },
  { method: 'GET', path: '/auth/logout', handler: handleLogout },
  { method: 'POST', path: '/api/tally-webhook', handler: (req, env) => handleTallyWithAuth(req, new URL(req.url), env) },
  // entropy-legacy-marker-ok: debt — TODO re-enable auth on GitHub content proxy after fixing vault token scopes
  { method: 'GET', path: '/api/content/github', handler: (req, env) => getGitHubContent(req, env, null) },
  { method: 'GET', path: '/api/content/github/tree', handler: (req, env) => listGitHubDirectory(req, env, null) },
  { method: 'POST', path: '/api/test/seed', handler: handleTestSeed },
];

// --- Auth middleware (session-based, for /api/* except public paths) ---

app.use('/api/*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_API_PATHS.some(p => path.startsWith(p))) return next();

  const auth = await authenticateRequest(c.req.raw, c.env);
  if (auth.error) return auth.error;

  c.set('auth', auth);
  c.set('userContext', {
    user: auth.user,
    contact: auth.contact,
    employee: auth.employee,
    learner: auth.contact || auth.employee,
  });
  await next();
});

// --- Route tables ---

// Handler signature: (request, env, userContext, ...params)
const standardRoutes = [
  { method: 'GET', path: '/api/auth/session', handler: getSession },
  { method: 'GET', path: '/api/admin/stats', handler: getAdminStats },
  { method: 'POST', path: '/api/events/batch', handler: handleBatchEvents },
  { method: 'GET', path: '/api/enrollments', handler: listEnrollments },
  { method: 'GET', path: '/api/courses', handler: listCourses },
  { method: 'GET', path: '/api/soms', handler: listCourses },
  { method: 'GET', path: '/api/kms/spaces', handler: listSpaces },
  { method: 'GET', path: '/api/translations/review', handler: getTranslationsForReview },
  { method: 'POST', path: '/api/translations/batch', handler: batchUpsertTranslations },
  { method: 'GET', path: '/api/badges', handler: listBadges },
  { method: 'GET', path: '/api/learner', handler: getLearnerProgress },
  { method: 'GET', path: '/api/profile', handler: getLearnerProgress },
  { method: 'GET', path: '/api/stats', handler: getUserStats },
  { method: 'GET', path: '/api/leaderboard', handler: getLeaderboard },
  { method: 'POST', path: '/api/quiz', handler: handleQuizSubmission },
  { method: 'POST', path: '/api/admin/api-keys', handler: adminCreateAPIKeyHandler },
  // With path params
  { method: 'GET', path: '/api/signals/:courseId/:stepId', handler: getStepSignals, params: ['courseId', 'stepId'] },
  { method: 'GET', path: '/api/signals/:courseId', handler: getCourseSignalsHandler, params: ['courseId'] },
  { method: 'POST', path: '/api/signals/:courseId/reset', handler: resetCourseSignals, params: ['courseId'] },
  { method: 'PATCH', path: '/api/enrollments/:courseId/progress', handler: updateProgress, params: ['courseId'] },
  { method: 'GET', path: '/api/courses/:courseId', handler: getCourse, params: ['courseId'] },
  { method: 'GET', path: '/api/soms/:courseId', handler: getCourse, params: ['courseId'] },
  { method: 'POST', path: '/api/courses/:courseId/enroll', handler: enrollInCourse, params: ['courseId'] },
  { method: 'POST', path: '/api/courses/:courseId/abandon', handler: abandonCourse, params: ['courseId'] },
  { method: 'POST', path: '/api/courses/:courseId/complete', handler: completeCourse, params: ['courseId'] },
  { method: 'GET', path: '/api/courses/:courseId/enrollment', handler: getEnrollmentStatus, params: ['courseId'] },
  { method: 'GET', path: '/api/kms/spaces/:spaceId', handler: getSpace, params: ['spaceId'] },
  { method: 'GET', path: '/api/kms/pages/:pageId', handler: getPage, params: ['pageId'] },
  { method: 'GET', path: '/api/translations/:namespace/:locale', handler: getTranslations, params: ['namespace', 'locale'] },
  { method: 'PUT', path: '/api/translations/:namespace/:locale/:key', handler: upsertTranslation, params: ['namespace', 'locale', 'key'] },
  { method: 'POST', path: '/api/glossary/:locale/import', handler: importGlossaryTerms, params: ['locale'] },
  { method: 'GET', path: '/api/glossary/:locale', handler: getGlossary, params: ['locale'] },
  { method: 'POST', path: '/api/glossary/:locale', handler: addGlossaryTerm, params: ['locale'] },
  { method: 'DELETE', path: '/api/glossary/:locale/:termId', handler: deleteGlossaryTerm, params: ['locale', 'termId'] },
];

// Handler signature: (request, env, auth, ...params)
const authKeyRoutes = [
  { method: 'POST', path: '/api/auth/api-keys', handler: createAPIKeyHandler },
  { method: 'GET', path: '/api/auth/api-keys', handler: listAPIKeysHandler },
  { method: 'DELETE', path: '/api/auth/api-keys/:keyId', handler: revokeAPIKeyHandler, params: ['keyId'] },
];

// Handler signature: (request, ctx, ...params) via createByocContext
const byocRoutes = [
  { method: 'GET', path: '/api/content/cloud', handler: getCloudContentController },
  { method: 'GET', path: '/api/content/cloud/pitch', handler: getCloudPitchController },
  { method: 'GET', path: '/api/connections', handler: listConnectionsController },
  { method: 'GET', path: '/api/connections/default', handler: getDefaultConnectionController },
  { method: 'GET', path: '/api/content/shared-with-me', handler: sharedWithMeController },
  { method: 'GET', path: '/api/content/shared-by-me', handler: sharedByMeController },
  { method: 'POST', path: '/api/content/:contentId/share', handler: shareContentController, params: ['contentId'] },
  { method: 'DELETE', path: '/api/content/:contentId/share/:shareId', handler: revokeShareController, params: ['contentId', 'shareId'] },
  { method: 'GET', path: '/api/content/:contentId/permissions', handler: listPermissionsController, params: ['contentId'] },
];

// --- Generic route registrar: ONE function, different context builders per group ---

function registerRoutes(honoApp, routes, buildArgs) {
  for (const route of routes) {
    honoApp.on(route.method, route.path, async (c) => {
      const args = await buildArgs(c);
      if (route.params) args.push(...route.params.map(p => c.req.param(p)));
      return route.handler(...args);
    });
  }
}

registerRoutes(app, publicRoutes, (c) => [c.req.raw, c.env]);
registerRoutes(app, standardRoutes, (c) => [c.req.raw, c.env, c.var.userContext]);

// Events with idempotency (only POST /api/events uses idempotency cache)
app.post('/api/events', async (c) => {
  const cachedResponse = checkIdempotency(c.req.raw);
  if (cachedResponse) return cachedResponse;
  const response = await handleEvent(c.req.raw, c.env, c.var.userContext);
  return cacheIdempotencyResponse(c.req.raw, response);
});

registerRoutes(app, authKeyRoutes, (c) => [c.req.raw, c.env, c.var.auth]);
registerRoutes(app, byocRoutes, async (c) => [c.req.raw, await createByocContext(c.req.raw, c.env, c.var.userContext)]);

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
};
