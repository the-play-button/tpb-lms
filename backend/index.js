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
import { configureLogger, setLoggerWaitUntil, log, createBastionAuthMiddleware, createBastionClient, createLazyVaultSecret } from '@the-play-button/tpb-sdk-js';
import { ALLOWED_ORIGINS, jsonResponse } from './cors.js';
import { verifyAPIKey } from './auth/verifyAPIKey.js';
import { getOrCreateContact } from './auth/getOrCreateContact.js';
import { getSession } from './handlers/auth.js';
import { listCourses, getCourse } from './handlers/courses.js';
import { listEnrollments, createEnrollment, updateEnrollment, getEnrollmentStatus, updateProgress } from './handlers/enrollment/index.js';
import { listBadges } from './handlers/badges.js';
import { createEvents } from './handlers/events.js';
import { getStepSignals, getCourseSignalsHandler, deleteCourseSignals } from './handlers/signals.js';
import { createQuizSubmission, handleTallyWebhook, handleTallyWebhookWithBody, verifyTallySignature } from './handlers/quiz/index.js';
import { getLearnerProgress } from './handlers/learner.js';
import { getLeaderboard, getUserStats } from './handlers/leaderboard.js';
import { handleTestSeed } from './handlers/test.js';
import { createAPIKeyHandler, listAPIKeysHandler, deleteAPIKeyHandler, adminCreateAPIKeyHandler } from './handlers/apikeys/index.js';
import { getAdminStats } from './handlers/admin.js';
import { listSpaces, getSpace, getPage } from './handlers/kms.js';
import { getTranslations, upsertTranslation, upsertTranslations, getTranslationsForReview } from './handlers/translations/index.js';
import { getGlossary, createGlossaryTerm, deleteGlossaryTerm } from './handlers/glossary/index.js';
import { getGitHubContent, listGitHubDirectory } from './handlers/content.js';
import { createByocContext } from './handlers/byocContext.js';
import { getCloudContentController } from './lms/application/cloudContent/getCloudContent/getCloudContentController.js';
import { getCloudPitchController } from './lms/application/cloudContent/getCloudPitch/getCloudPitchController.js';
import { listConnectionsController } from './lms/application/connections/listConnections/listConnectionsController.js';
import { getDefaultConnectionController } from './lms/application/connections/getDefaultConnection/getDefaultConnectionController.js';
import { createShareController } from './lms/application/sharing/createShare/createShareController.js';
import { deleteShareController } from './lms/application/sharing/deleteShare/deleteShareController.js';
import { listPermissionsController } from './lms/application/sharing/listPermissions/listPermissionsController.js';
import { listSharedWithMeController } from './lms/application/sharing/listSharedWithMe/index.js';
import { listSharedByMeController } from './lms/application/sharing/listSharedByMe/index.js';
// Content-authoring CRUD (Plan 02): create/update/delete courses + classes.
import { createAuthoringContext } from './handlers/authoringContext.js';
import { createCourseController } from './lms/application/courses/createCourse/index.js';
import { updateCourseController } from './lms/application/courses/updateCourse/index.js';
import { deleteCourseController } from './lms/application/courses/deleteCourse/index.js';
import { createClassController } from './lms/application/classes/createClass/index.js';
import { updateClassController } from './lms/application/classes/updateClass/index.js';
import { deleteClassController } from './lms/application/classes/deleteClass/index.js';
import { checkRateLimit } from './middleware/rateLimit.js';
import { checkIdempotency, cacheIdempotencyResponse } from './middleware/idempotency.js';


// --- BastionClient singleton (cached per-isolate). No vault dep. ---
let _bastionClient = null;

const initBastionClient = async (env) => {
  if (_bastionClient) return _bastionClient;
  _bastionClient = createBastionClient({
    bastionUrl: env.BASTION_URL,
    serviceToken: env.BASTION_TOKEN,
  });
  return _bastionClient;
};

// Vault secrets — blessed primitive (cf. CLAUDE.md § HONO — Init lazy des secrets vault).
const getTelemetryCfAccessSa = createLazyVaultSecret('tpb/infra/cf_access_sa_client_secret');
const getTallySigningSecret  = createLazyVaultSecret('tpb/apps/lms/tally_signing_secret');
const getTallyWebhookSecret  = createLazyVaultSecret('tpb/apps/lms/tally_webhook_secret');

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
    // Telemetry is best-effort: a broken secret fetch must NOT crash the Worker
    // (that turns every request into CF 1101 "Worker threw exception"). Log the
    // failure to the CF tail and mark the logger ready so we don't retry per request.
    try {
      const cfAccessSecret = await getTelemetryCfAccessSa(c.env);
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
    } catch (err) {
      // Last-resort stderr — `log` SDK ELSE branch when its own init throws.
      // Cannot use `log.error()` here : the catch block exists precisely
      // because `configureLogger()` failed. Per § ALWAYS FAIL HARD : the
      // failure must surface to the CF Worker tail logs (= what stderr
      // becomes in the Workers runtime).
      // eslint-disable-next-line no-console
      globalThis.console.error('[telemetry] logger init failed — continuing without telemetry:', err);
      loggerReady = true; // explicit recovery — don't retry on every request
    }
  }
  setLoggerWaitUntil(c.executionCtx.waitUntil.bind(c.executionCtx));
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
  const dbCheck = await c.env.DB.prepare('SELECT 1 as ok').first().catch(() => null);
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

/**
 * Constant-time string comparison — XOR loop over UTF-8 bytes. Returns
 * true iff the inputs are byte-equal in length AND content. Per bearer
 * § observable-timing : short-circuit `===` on secret-equality leaks
 * length + prefix-match info via observable timing.
 */
const timingSafeStrEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
};

// --- Tally webhook auth (signature-based, not session-based) ---
const handleTallyWithAuth = async (request, url, env) => {
  const signingSecret = await getTallySigningSecret(env);
  const { isValid, body, noSignature } = await verifyTallySignature(request, signingSecret);
  if (noSignature) {
    const webhookSecret = url.searchParams.get('secret');
    const expectedSecret = await getTallyWebhookSecret(env);
    if (!timingSafeStrEqual(webhookSecret ?? '', expectedSecret ?? '')) {
      return jsonResponse({ error: 'Invalid webhook: no signature and invalid secret' }, 403, request);
    }
    return await handleTallyWebhookWithBody(body, env, request);
  }
  if (!isValid) return jsonResponse({ error: 'Invalid Tally signature' }, 403, request);
  return await handleTallyWebhookWithBody(body, env, request);
};

// --- Public routes (no session auth) ---

const PUBLIC_API_PATHS = ['/api/health', '/api/tally-webhook', '/api/content/github', '/api/test/seed'];

const publicRoutes = [
  { method: 'POST', path: '/api/tally-webhook', handler: (req, env) => handleTallyWithAuth(req, new URL(req.url), env) },
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
  // Derive the LMS role from the bastion-resolved actor roles (§ BASTION AUTH:
  // consume ctx.actor, never re-call IAM). tpblms_admin/tpblms_instructor are the
  // LMS bastion role names; absence = regular student.
  const roleNames = actor.roles || [];
  const role = roleNames.includes('tpblms_admin') ? 'admin'
    : roleNames.includes('tpblms_instructor') ? 'instructor'
    : 'student';
  if (actor.email) {
    contact = await getOrCreateContact(actor.email, c.env);
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

  // initBastionClient fetches the authz signing secret; a failure here must
  // not crash the Worker (1101). Handlers that actually need the client will
  // re-call initBastionClient and fail visibly at that point with a 500.
  let bastionInitOk = false;
  try {
    await initBastionClient(c.env);
    bastionInitOk = true;
  } catch (err) {
    log.error('initBastionClient failed', err, { file: 'index.js', layer: 'authz' });
    bastionInitOk = false;
  }
  c.set('bastionInitOk', bastionInitOk);

  return next();
});

// --- Route tables ---

const standardRoutes = [
  { method: 'GET', path: '/api/auth/session', handler: getSession },
  { method: 'GET', path: '/api/admin/stats', handler: getAdminStats },
  { method: 'GET', path: '/api/enrollments', handler: listEnrollments },
  { method: 'GET', path: '/api/courses', handler: listCourses },
  { method: 'GET', path: '/api/kms/spaces', handler: listSpaces },
  { method: 'GET', path: '/api/translations', handler: getTranslationsForReview },
  { method: 'PUT', path: '/api/translations', handler: upsertTranslations },
  { method: 'GET', path: '/api/badges', handler: listBadges },
  { method: 'GET', path: '/api/learner', handler: getLearnerProgress },
  { method: 'GET', path: '/api/stats', handler: getUserStats },
  { method: 'GET', path: '/api/leaderboard', handler: getLeaderboard },
  { method: 'POST', path: '/api/quiz-submissions', handler: createQuizSubmission },
  { method: 'POST', path: '/api/admin/api-keys', handler: adminCreateAPIKeyHandler },
  { method: 'GET', path: '/api/signals/:courseId/:stepId', handler: getStepSignals, params: ['courseId', 'stepId'] },
  { method: 'GET', path: '/api/signals/:courseId', handler: getCourseSignalsHandler, params: ['courseId'] },
  { method: 'DELETE', path: '/api/signals/:courseId', handler: deleteCourseSignals, params: ['courseId'] },
  { method: 'PATCH', path: '/api/enrollments/:courseId/progress', handler: updateProgress, params: ['courseId'] },
  { method: 'POST', path: '/api/enrollments', handler: createEnrollment },
  { method: 'PATCH', path: '/api/enrollments/:courseId', handler: updateEnrollment, params: ['courseId'] },
  { method: 'GET', path: '/api/enrollments/:courseId', handler: getEnrollmentStatus, params: ['courseId'] },
  { method: 'GET', path: '/api/courses/:courseId', handler: getCourse, params: ['courseId'] },
  { method: 'GET', path: '/api/kms/spaces/:spaceId', handler: getSpace, params: ['spaceId'] },
  { method: 'GET', path: '/api/kms/pages/:pageId', handler: getPage, params: ['pageId'] },
  { method: 'GET', path: '/api/translations/:namespace/:locale', handler: getTranslations, params: ['namespace', 'locale'] },
  { method: 'PUT', path: '/api/translations/:namespace/:locale/:key', handler: upsertTranslation, params: ['namespace', 'locale', 'key'] },
  { method: 'GET', path: '/api/glossary/:locale', handler: getGlossary, params: ['locale'] },
  { method: 'POST', path: '/api/glossary/:locale', handler: createGlossaryTerm, params: ['locale'] },
  { method: 'DELETE', path: '/api/glossary/:locale/:termId', handler: deleteGlossaryTerm, params: ['locale', 'termId'] },
];

const authKeyRoutes = [
  { method: 'POST', path: '/api/auth/api-keys', handler: createAPIKeyHandler },
  { method: 'GET', path: '/api/auth/api-keys', handler: listAPIKeysHandler },
  { method: 'DELETE', path: '/api/auth/api-keys/:keyId', handler: deleteAPIKeyHandler, params: ['keyId'] },
];

// Filtered-read dispatchers (§ crud_list_only_endpoint_design § 2 Filter): one URL,
// variant selected by query param — instead of a disguised sub-resource URL.
const cloudContentDispatch = (request, ctx) =>
  new URL(request.url).searchParams.get('usage') === 'pitch'
    ? getCloudPitchController(request, ctx)
    : getCloudContentController(request, ctx);

const connectionsDispatch = (request, ctx) =>
  new URL(request.url).searchParams.get('default') === 'true'
    ? getDefaultConnectionController(request, ctx)
    : listConnectionsController(request, ctx);

const byocRoutes = [
  { method: 'GET', path: '/api/content/cloud', handler: cloudContentDispatch },
  { method: 'GET', path: '/api/connections', handler: connectionsDispatch },
  { method: 'GET', path: '/api/content/shared-with-me', handler: listSharedWithMeController },
  { method: 'GET', path: '/api/content/shared-by-me', handler: listSharedByMeController },
  { method: 'POST', path: '/api/content/:contentId/share', handler: createShareController, params: ['contentId'] },
  { method: 'DELETE', path: '/api/content/:contentId/share/:shareId', handler: deleteShareController, params: ['contentId', 'shareId'] },
  { method: 'GET', path: '/api/content/:contentId/permissions', handler: listPermissionsController, params: ['contentId'] },
];

// Content-authoring CRUD (Plan 02): Tier 1 create/update/delete on courses + classes.
const authoringRoutes = [
  { method: 'POST',   path: '/api/courses',           handler: createCourseController },
  { method: 'PATCH',  path: '/api/courses/:courseId', handler: updateCourseController, params: ['courseId'] },
  { method: 'DELETE', path: '/api/courses/:courseId', handler: deleteCourseController, params: ['courseId'] },
  { method: 'POST',   path: '/api/classes',           handler: createClassController },
  { method: 'PATCH',  path: '/api/classes/:classId',  handler: updateClassController, params: ['classId'] },
  { method: 'DELETE', path: '/api/classes/:classId',  handler: deleteClassController, params: ['classId'] },
];

// --- Generic route registrar: ONE function, different context builders per group ---

const registerRoutes = (honoApp, routes, buildArgs) => {
  for (const route of routes) {
    honoApp.on(route.method, route.path, async (c) => {
      const args = await buildArgs(c);
      if (route.params) args.push(...route.params.map(p => c.req.param(p)));
      if (route.idempotent) {
        const cachedResponse = checkIdempotency(c.req.raw);
        if (cachedResponse) return cachedResponse;
        const response = await route.handler(...args);
        return cacheIdempotencyResponse(c.req.raw, response);
      }
      return route.handler(...args);
    });
  }
};

const idempotentStandardRoutes = [
  { method: 'POST', path: '/api/events', handler: createEvents, idempotent: true },
];

registerRoutes(app, publicRoutes, (c) => [c.req.raw, c.env]);
registerRoutes(app, standardRoutes, (c) => [c.req.raw, c.env, c.var.userContext]);
registerRoutes(app, idempotentStandardRoutes, (c) => [c.req.raw, c.env, c.var.userContext]);

registerRoutes(app, authKeyRoutes, (c) => [c.req.raw, c.env, c.var.auth]);
registerRoutes(app, byocRoutes, async (c) => {
  const authzClient = _bastionClient || await initBastionClient(c.env);
  return [c.req.raw, await createByocContext(c.req.raw, c.env, c.var.userContext, authzClient, c.var.actor || { id: '', email: null, type: 'unknown', bastionUserId: null, scopes: [], organizationId: null, roles: [] })];
});

// Content-authoring CRUD (Plan 02): PBAC via hasScope on the actor (no ReBAC).
registerRoutes(app, authoringRoutes, (c) => [
  c.req.raw,
  createAuthoringContext(c.req.raw, c.env, c.var.userContext, c.var.actor || { id: '', email: null, type: 'unknown', bastionUserId: null, scopes: [], organizationId: null, roles: [] }),
]);

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
};
