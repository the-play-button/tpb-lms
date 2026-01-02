/**
 * TPB Vault API
 * 
 * Architecture:
 * - Secrets Engine: KV-style path-based secrets (/secret/*)
 * - Legacy: Unified.to aligned connections (deprecated)
 * - Storage: D1 for metadata, Cloudflare Secrets for values
 * 
 * Endpoints:
 * - GET /health - Health check (public)
 * - /secret/* - KV Secrets Engine
 * - /vault/connections - Legacy connections (deprecated)
 * - /iam/* - Identity and Access Management
 */

import { error, success, handleOptions } from './utils/response.js';
import { validateAccess } from './middleware/auth.js';

// Handlers
import { 
  listConnections, 
  getConnection, 
  createConnection, 
  updateConnection, 
  deleteConnection,
  listSecretRefs,
  addSecretRef,
  updateSecret,
  deleteSecretRef,
} from './handlers/connections.js';
import { getAuditLog } from './handlers/audit.js';
import { 
  listServiceTokens,
  createServiceToken,
  revokeServiceToken,
  cleanupOrphanTokens
} from './handlers/iam.js';
import {
  listUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
  grantAccess,
  revokeAccess,
  getUserRoles
} from './handlers/users.js';
import {
  listGroups,
  createGroup,
  getGroup,
  updateGroup,
  addMember,
  removeMember,
  assignRole,
  removeRole
} from './handlers/groups.js';
import {
  listRoles,
  createRole,
  getRole,
  addPermission,
  removePermission,
  listPermissions,
  createPermission
} from './handlers/roles.js';
import {
  checkCan,
  getMyAbilities
} from './handlers/can.js';
import {
  listApplications,
  getApplication,
  createApplication,
  updateApplication,
  deleteApplication,
  rotateCredentials,
  syncAudiences,
  listOrphanResources
} from './handlers/applications.js';
import {
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganizationMembers,
  getOrganizationAudit
} from './handlers/organizations.js';
import {
  landingPage,
  dashboard,
  applicationsDashboard
} from './handlers/ui.js';
import {
  dashboard as cloudflareResourcesDashboard,
  listResources,
  listByType,
  getDetails
} from './handlers/cloudflareResources.js';
import {
  writeSecret,
  readSecret,
  deleteSecret,
  readMetadata,
  listSecrets
} from './handlers/secrets.js';

/**
 * Wrap handler to add deprecation warning header
 */
function deprecated(handler) {
  return async (request, env, ctx) => {
    const response = await handler(request, env, ctx);
    // Clone response to add headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Deprecation', 'true');
    newHeaders.set('Sunset', '2025-06-01');
    newHeaders.set('X-Deprecation-Notice', 'This endpoint is deprecated. Use /secret/* endpoints instead.');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  };
}

// Route definitions
const routes = [
  // UI (both / and /dashboard require auth - CF Access handles login)
  { method: 'GET', pattern: /^\/$/, handler: dashboard },
  { method: 'GET', pattern: /^\/dashboard$/, handler: dashboard },
  
  // Health (public)
  { method: 'GET', pattern: /^\/health$/, handler: healthCheck, public: true },
  
  // ============================================
  // Secrets Engine (KV)
  // ============================================
  { method: 'POST', pattern: /^\/secret\/data\/(.+)$/, handler: writeSecret, params: ['path'] },
  { method: 'GET', pattern: /^\/secret\/data\/(.+)$/, handler: readSecret, params: ['path'] },
  { method: 'DELETE', pattern: /^\/secret\/data\/(.+)$/, handler: deleteSecret, params: ['path'] },
  { method: 'GET', pattern: /^\/secret\/metadata\/(.+)$/, handler: readMetadata, params: ['path'] },
  { method: 'GET', pattern: /^\/secret\/list\/(.*)$/, handler: listSecrets, params: ['prefix'] },
  { method: 'GET', pattern: /^\/secret\/list$/, handler: listSecrets, params: [] },
  
  // ============================================
  // Legacy Connections (DEPRECATED - use /secret/* instead)
  // Will be removed in future version
  // ============================================
  { method: 'GET', pattern: /^\/vault\/connections$/, handler: deprecated(listConnections), deprecated: true },
  { method: 'POST', pattern: /^\/vault\/connections$/, handler: deprecated(createConnection), deprecated: true },
  { method: 'GET', pattern: /^\/vault\/connections\/([^\/]+)$/, handler: deprecated(getConnection), params: ['id'], deprecated: true },
  { method: 'PATCH', pattern: /^\/vault\/connections\/([^\/]+)$/, handler: deprecated(updateConnection), params: ['id'], deprecated: true },
  { method: 'DELETE', pattern: /^\/vault\/connections\/([^\/]+)$/, handler: deprecated(deleteConnection), params: ['id'], deprecated: true },
  { method: 'GET', pattern: /^\/vault\/connections\/([^\/]+)\/secrets$/, handler: deprecated(listSecretRefs), params: ['id'], deprecated: true },
  { method: 'POST', pattern: /^\/vault\/connections\/([^\/]+)\/secrets$/, handler: deprecated(addSecretRef), params: ['id'], deprecated: true },
  { method: 'PUT', pattern: /^\/vault\/connections\/([^\/]+)\/secrets\/([^\/]+)$/, handler: deprecated(updateSecret), params: ['id', 'name'], deprecated: true },
  { method: 'DELETE', pattern: /^\/vault\/connections\/([^\/]+)\/secrets\/([^\/]+)$/, handler: deprecated(deleteSecretRef), params: ['id', 'name'], deprecated: true },
  { method: 'GET', pattern: /^\/vault\/connections\/([^\/]+)\/audit$/, handler: deprecated(getAuditLog), params: ['id'], deprecated: true },
  
  // IAM - Service Token Management (self-service)
  { method: 'GET', pattern: /^\/iam\/service-tokens$/, handler: listServiceTokens },
  { method: 'POST', pattern: /^\/iam\/service-tokens$/, handler: createServiceToken },
  { method: 'DELETE', pattern: /^\/iam\/service-tokens\/orphans$/, handler: cleanupOrphanTokens },
  { method: 'DELETE', pattern: /^\/iam\/service-tokens\/([^\/]+)$/, handler: revokeServiceToken, params: ['tokenId'] },
  
  // IAM - User Management
  { method: 'GET', pattern: /^\/iam\/users$/, handler: listUsers },
  { method: 'POST', pattern: /^\/iam\/users$/, handler: createUser },
  { method: 'GET', pattern: /^\/iam\/users\/([^\/]+)$/, handler: getUser, params: ['userId'] },
  { method: 'GET', pattern: /^\/iam\/users\/([^\/]+)\/roles$/, handler: getUserRoles, params: ['identifier'] },
  { method: 'PATCH', pattern: /^\/iam\/users\/([^\/]+)$/, handler: updateUser, params: ['userId'] },
  { method: 'DELETE', pattern: /^\/iam\/users\/([^\/]+)$/, handler: deleteUser, params: ['userId'] },
  { method: 'POST', pattern: /^\/iam\/users\/([^\/]+)\/grant-access$/, handler: grantAccess, params: ['userId'] },
  { method: 'POST', pattern: /^\/iam\/users\/([^\/]+)\/revoke-access$/, handler: revokeAccess, params: ['userId'] },
  
  // IAM - Group Management
  { method: 'GET', pattern: /^\/iam\/groups$/, handler: listGroups },
  { method: 'POST', pattern: /^\/iam\/groups$/, handler: createGroup },
  { method: 'GET', pattern: /^\/iam\/groups\/([^\/]+)$/, handler: getGroup, params: ['groupId'] },
  { method: 'PATCH', pattern: /^\/iam\/groups\/([^\/]+)$/, handler: updateGroup, params: ['groupId'] },
  { method: 'POST', pattern: /^\/iam\/groups\/([^\/]+)\/members$/, handler: addMember, params: ['groupId'] },
  { method: 'DELETE', pattern: /^\/iam\/groups\/([^\/]+)\/members\/([^\/]+)$/, handler: removeMember, params: ['groupId', 'userId'] },
  { method: 'POST', pattern: /^\/iam\/groups\/([^\/]+)\/roles$/, handler: assignRole, params: ['groupId'] },
  { method: 'DELETE', pattern: /^\/iam\/groups\/([^\/]+)\/roles\/([^\/]+)$/, handler: removeRole, params: ['groupId', 'roleId'] },
  
  // IAM - Role Management
  { method: 'GET', pattern: /^\/iam\/roles$/, handler: listRoles },
  { method: 'POST', pattern: /^\/iam\/roles$/, handler: createRole },
  { method: 'GET', pattern: /^\/iam\/roles\/([^\/]+)$/, handler: getRole, params: ['roleId'] },
  { method: 'POST', pattern: /^\/iam\/roles\/([^\/]+)\/permissions$/, handler: addPermission, params: ['roleId'] },
  { method: 'DELETE', pattern: /^\/iam\/roles\/([^\/]+)\/permissions\/([^\/]+)$/, handler: removePermission, params: ['roleId', 'permissionId'] },
  { method: 'GET', pattern: /^\/iam\/permissions$/, handler: listPermissions },
  { method: 'POST', pattern: /^\/iam\/permissions$/, handler: createPermission },
  
  // IAM - Application Management (superadmin only)
  { method: 'GET', pattern: /^\/iam\/applications$/, handler: listApplications },
  { method: 'POST', pattern: /^\/iam\/applications$/, handler: createApplication },
  { method: 'GET', pattern: /^\/iam\/applications\/orphans$/, handler: listOrphanResources },
  { method: 'GET', pattern: /^\/iam\/applications\/([^\/]+)$/, handler: getApplication, params: ['appId'] },
  { method: 'PATCH', pattern: /^\/iam\/applications\/([^\/]+)$/, handler: updateApplication, params: ['appId'] },
  { method: 'DELETE', pattern: /^\/iam\/applications\/([^\/]+)$/, handler: deleteApplication, params: ['appId'] },
  { method: 'POST', pattern: /^\/iam\/applications\/([^\/]+)\/rotate-credentials$/, handler: rotateCredentials, params: ['appId'] },
  { method: 'POST', pattern: /^\/iam\/applications\/([^\/]+)\/sync-audiences$/, handler: syncAudiences, params: ['appId'] },
  
  // UI - Applications Dashboard
  { method: 'GET', pattern: /^\/applications\/dashboard$/, handler: applicationsDashboard },
  
  // IAM - Authorization (CASL)
  { method: 'POST', pattern: /^\/iam\/can$/, handler: checkCan },
  { method: 'GET', pattern: /^\/iam\/me\/abilities$/, handler: getMyAbilities },
  
  // IAM - Organization Management
  { method: 'GET', pattern: /^\/iam\/organizations$/, handler: listOrganizations },
  { method: 'POST', pattern: /^\/iam\/organizations$/, handler: createOrganization },
  { method: 'GET', pattern: /^\/iam\/organizations\/([^\/]+)$/, handler: getOrganization, params: ['orgId'] },
  { method: 'PATCH', pattern: /^\/iam\/organizations\/([^\/]+)$/, handler: updateOrganization, params: ['orgId'] },
  { method: 'DELETE', pattern: /^\/iam\/organizations\/([^\/]+)$/, handler: deleteOrganization, params: ['orgId'] },
  { method: 'GET', pattern: /^\/iam\/organizations\/([^\/]+)\/members$/, handler: getOrganizationMembers, params: ['orgId'] },
  { method: 'GET', pattern: /^\/iam\/organizations\/([^\/]+)\/audit$/, handler: getOrganizationAudit, params: ['orgId'] },
  
  // Cloudflare Resources Dashboard
  { method: 'GET', pattern: /^\/cloudflare\/dashboard$/, handler: cloudflareResourcesDashboard },
  { method: 'GET', pattern: /^\/cloudflare\/resources$/, handler: listResources },
  { method: 'GET', pattern: /^\/cloudflare\/resources\/([^\/]+)$/, handler: listByType, params: ['type'] },
  { method: 'GET', pattern: /^\/cloudflare\/resources\/([^\/]+)\/([^\/]+)$/, handler: getDetails, params: ['type', 'id'] },
];

// Health check
async function healthCheck(request, env, ctx) {
  try {
    // Check D1
    const { results } = await env.DB.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM connection) as connections,
        (SELECT COUNT(*) FROM sys_secret_ref) as secrets
    `).all();
    
    return success({ 
      status: 'healthy',
      service: 'tpb-vault-infra',
      stats: results[0],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return error('Database unavailable', 503);
  }
}

// Router
function matchRoute(method, pathname) {
  for (const route of routes) {
    if (route.method !== method) continue;
    
    const match = pathname.match(route.pattern);
    if (match) {
      const params = {};
      if (route.params) {
        route.params.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
      }
      return { handler: route.handler, params, public: route.public };
    }
  }
  return null;
}

// Main entry
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { method } = request;
    const pathname = url.pathname;
    
    // CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions();
    }
    
    // Find route
    const route = matchRoute(method, pathname);
    
    if (!route) {
      return error('Not found', 404, 'NOT_FOUND');
    }
    
    // Auth for non-public routes
    if (!route.public) {
      const auth = await validateAccess(request, env);
      if (!auth.valid) {
        const status = auth.code === 'FORBIDDEN' ? 403 : 401;
        return error(auth.error, status, auth.code || 'UNAUTHORIZED');
      }
      ctx.actor = auth.actor;
    }
    
    // Add params to context
    ctx.params = route.params;
    
    // Execute
    try {
      return await route.handler(request, env, ctx);
    } catch (err) {
      console.error('Handler error:', err);
      return error(`Internal error: ${err.message}`, 500);
    }
  }
};
