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
import { configureLogger, log, createBastionAuthMiddleware, createBastionClient } from '@the-play-button/tpb-sdk-js';
import { ALLOWED_ORIGINS, jsonResponse } from './cors.js';
import { verifyAPIKey } from './auth/verifyAPIKey.js';
import { getOrCreateContact } from './auth/getOrCreateContact.js';
import { resolveRole } from './auth/resolveRole.js';
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


// --- BastionClient singleton with authzSigningSecret (cached per-isolate) ---
let _bastionClient = null;

const initBastionClient = async (env) => {
  if (_bastionClient) return _bastionClient;
  const tempClient = createBastionClient({
    bastionUrl: env.BASTION_URL,
    serviceToken: env.BASTION_TOKEN,
  });
  const secretResult = await tempClient.getSecret('tpb/apps/lms/authz_signing_secret');
  if (!secretResult.ok) throw new Error(`[initBastionClient] ${secretResult.error}`);
  if (!secretResult.value) throw new Error('[initBastionClient] authz signing secret is empty');
  _bastionClient = createBastionClient({
    bastionUrl: env.BASTION_URL,
    serviceToken: env.BASTION_TOKEN,
    authzSigningSecret: secretResult.value,
  });
  return _bastionClient;
};

// --- Telemetry CF Access secret (vault, cached per-isolate) ---
let _telemetryCfAccessSecret = null;

const fetchTelemetryCfAccessSecret = async (env) => {
  if (_telemetryCfAccessSecret) return _telemetryCfAccessSecret;
  const bastion = await initBastionClient(env);
  const result = await bastion.getSecret('tpb/infra/cf_access_sa_client_secret');
  if (!result.ok) throw new Error(`[telemetry] CF Access SA secret fetch failed: ${result.error}`);
  if (!result.value) throw new Error('[telemetry] CF Access SA secret is empty');
  _telemetryCfAccessSecret = result.value;
  return _telemetryCfAccessSecret;
};

// --- Hono app ---

const app = new Hono();

app.use('/*', cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  allowHeaders: ['Content-Type', 'Cf-Access-Jwt-Assertion', 'x-session-id', 'Authorization', 'X-Idempotency-Key'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-Idempotency-Cached'],
  maxAge: 86400,
}));

let loggerReady = false;
app.use('/*', async (c, next) => {
  if (!loggerReady) {
    const cfAccessSecret = await fetchTelemetryCfAccessSecret(c.env);
    configureLogger({
      service: 'tpb-lms',
      telemetry: {
        url: c.env.TELEMETRY_URL,
        token: c.env.BASTION_TOKEN ?? '',
        projectSlug: 'tpb-lms',
        environment: 'production',
        cfAccessClientId: c.env.CF_ACCESS_CLIENT_ID,
        cfAccessClientSecret: cfAccessSecret,
      },
    });
    loggerReady = true;
  }
  return next();
});

app.use('/*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});

app.onError((err, c) => {
  log.error('unhandled error', err, { file: 'index.js' });
  return c.json({ error: 'Internal Server Error' }, 500);
});

app.get('/health', (c) => c.json({ status: 'ok', service: 'tpb-lms' }));
app.get('/api/health', async (c) => {
  const dbCheck = await c.env.DB.prepare('SELECT 1 as ok').first().catch(() => null); // entropy-then-catch-finally-ok entropy-catch-return-default-ok: health probe — null signals DB unreachable, caller checks isDbUp
  const isDbUp = dbCheck?.ok === 1;
  return c.json({
    status: isDbUp ? 'healthy' : 'degraded',
    checks: { database: { status: isDbUp ? 'up' : 'down' } },
    timestamp: new Date().toISOString(),
    version: '2.1.0',
  });
});

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
  { method: 'POST', path: '/api/tally-webhook', handler: (req, env) => handleTallyWithAuth(req, new URL(req.url), env) },
  // entropy-legacy-marker-ok: debt — TODO re-enable auth on GitHub content proxy after fixing vault token scopes
  { method: 'GET', path: '/api/content/github', handler: (req, env) => getGitHubContent(req, env, null) },
  { method: 'GET', path: '/api/content/github/tree', handler: (req, env) => listGitHubDirectory(req, env, null) },
  { method: 'POST', path: '/api/test/seed', handler: handleTestSeed },
];

// --- Layer 1: API key pre-auth (LMS-local tpb_xxx keys — bastion doesn't know these) ---

app.use('/api/*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_API_PATHS.some(p => path.startsWith(p))) return next();

  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer tpb_')) {
    const keyResult = await verifyAPIKey(authHeader.slice(7), c.env);
    if (!keyResult.valid) return c.json({ error: 'Invalid API key' }, 401);
    c.set('actor', {
      id: keyResult.keyName || keyResult.keyId,
      bastionUserId: keyResult.userId || null,
      email: null,
      type: 'api_key',
      scopes: keyResult.scopes ? (typeof keyResult.scopes === 'string' ? JSON.parse(keyResult.scopes) : keyResult.scopes) : [],
      organizationId: null,
      roles: [],
    });
    return next();
  }
  return next();
});

// --- Layer 2: Bastion auth (skip if API key already resolved actor) ---

app.use('/api/*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_API_PATHS.some(p => path.startsWith(p))) return next();
  if (c.var.actor) return next();

  return createBastionAuthMiddleware((ctx) => ({
    bastionUrl: ctx.env.BASTION_URL,
    serviceToken: ctx.env.BASTION_TOKEN,
  }))(c, next);
});

// --- Layer 3: LMS domain enrichment (contact, role, bastionClient init) ---

app.use('/api/*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_API_PATHS.some(p => path.startsWith(p))) return next();

  const actor = c.var.actor;
  if (!actor) return next();

  let contact = null;
  let role = 'student';
  if (actor.email) {
    contact = await getOrCreateContact(actor.email, c.env);
    role = await resolveRole(actor.email, c.env);
  }

  c.set('auth', {
    user: { email: actor.email, role, payload: null },
    contact,
    learner: contact,
    authMethod: actor.type === 'api_key' ? 'api_key' : 'bastion',
  });
  c.set('userContext', {
    user: { email: actor.email, role },
    contact,
    employee: null,
    learner: contact,
  });

  await initBastionClient(c.env);

  return next();
});

// --- Route tables ---

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

const authKeyRoutes = [
  { method: 'POST', path: '/api/auth/api-keys', handler: createAPIKeyHandler },
  { method: 'GET', path: '/api/auth/api-keys', handler: listAPIKeysHandler },
  { method: 'DELETE', path: '/api/auth/api-keys/:keyId', handler: revokeAPIKeyHandler, params: ['keyId'] },
];

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

const registerRoutes = (honoApp, routes, buildArgs) => {
  for (const route of routes) {
    honoApp.on(route.method, route.path, async (c) => {
      const args = await buildArgs(c);
      if (route.params) args.push(...route.params.map(p => c.req.param(p)));
      return route.handler(...args);
    });
  }
};

registerRoutes(app, publicRoutes, (c) => [c.req.raw, c.env]);
registerRoutes(app, standardRoutes, (c) => [c.req.raw, c.env, c.var.userContext]);

app.post('/api/events', async (c) => {
  const cachedResponse = checkIdempotency(c.req.raw);
  if (cachedResponse) return cachedResponse;
  const response = await handleEvent(c.req.raw, c.env, c.var.userContext);
  return cacheIdempotencyResponse(c.req.raw, response);
});

registerRoutes(app, authKeyRoutes, (c) => [c.req.raw, c.env, c.var.auth]);
registerRoutes(app, byocRoutes, async (c) => {
  const authzClient = _bastionClient || await initBastionClient(c.env);
  return [c.req.raw, await createByocContext(c.req.raw, c.env, c.var.userContext, authzClient, c.var.actor || { id: '', email: null, type: 'unknown', bastionUserId: null, scopes: [], organizationId: null, roles: [] })];
});

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
};
