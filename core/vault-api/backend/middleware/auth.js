// Authentication middleware for Cloudflare Access JWT validation
// Security model:
// - SuperAdmin (via IAM): full CRUD access
// - Admin (via IAM): limited CRUD access (no access to other users' secrets)
// - Service tokens: READ ONLY (GET) + whitelisted POST (read-like operations)

import { error } from '../utils/response.js';
import { isAdmin, isSuperAdmin } from '../handlers/can.js';

// POST endpoints that are safe for service tokens (read-like operations)
const SERVICE_TOKEN_SAFE_POSTS = [
  '/iam/can'  // Authorization check is a query, not a mutation
];

// Routes self-service autorisees pour tous les utilisateurs authentifies
const USER_SELF_SERVICE_PATTERNS = [
  { method: 'POST', pattern: /^\/iam\/service-tokens$/ },
  { method: 'DELETE', pattern: /^\/iam\/service-tokens\/[^\/]+$/ }
];

/**
 * Validate Cloudflare Access JWT
 * Bypass for /health endpoint
 */
export async function validateAccess(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  
  // Health check bypass
  if (url.pathname === '/health') {
    return { valid: true, actor: { id: 'system', type: 'health_check', role: 'public' } };
  }
  
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  
  if (!jwt) {
    return { valid: false, error: 'Missing Cf-Access-Jwt-Assertion header' };
  }
  
  try {
    // Decode JWT payload (base64 middle part)
    const parts = jwt.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid JWT format' };
    }
    
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Validate issuer and audience
    const teamDomain = env.ACCESS_TEAM_DOMAIN || 'theplaybutton';
    const expectedIssuer = `https://${teamDomain}.cloudflareaccess.com`;
    
    if (payload.iss !== expectedIssuer) {
      return { valid: false, error: `Invalid issuer: ${payload.iss}` };
    }
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Token expired' };
    }
    
    // Determine actor type and role using IAM
    const isEmailAuth = !!payload.email;
    let role = 'reader';
    let scopes = [];
    let applicationId = null;
    let namespace = null;
    
    if (isEmailAuth) {
      // Check IAM roles for email users
      const isSuperAdminUser = await isSuperAdmin(env, payload.email);
      const isAdminUser = await isAdmin(env, payload.email);
      
      if (isSuperAdminUser) {
        role = 'superadmin';
      } else if (isAdminUser) {
        role = 'admin';
      }
    } else {
      // For service tokens, lookup scopes from iam_service_token (via iam_application)
      // Try multiple identifiers: sub (UUID), common_name (name), or client_id
      const cfTokenId = payload.sub || payload.common_name;
      if (cfTokenId) {
        // Check both cf_token_id (UUID) and cf_client_id (xxx.access format)
        const tokenInfo = await env.DB.prepare(`
          SELECT st.scopes, st.application_id, a.namespace, a.status as app_status
          FROM iam_service_token st
          LEFT JOIN iam_application a ON st.application_id = a.id
          WHERE (st.cf_token_id = ? OR st.cf_client_id = ?) AND st.revoked_at IS NULL
        `).bind(cfTokenId, cfTokenId).first();
        
        if (tokenInfo) {
          scopes = tokenInfo.scopes?.split(',') || [];
          applicationId = tokenInfo.application_id;
          namespace = tokenInfo.namespace;
          
          // Check application is still active
          if (tokenInfo.app_status && tokenInfo.app_status !== 'active') {
            return { valid: false, error: 'Application is suspended or revoked', code: 'FORBIDDEN' };
          }
        }
      }
    }
    
    const actor = {
      id: payload.email || payload.common_name || payload.sub || 'unknown',
      type: isEmailAuth ? 'user' : 'service_token',
      role: role,
      scopes: scopes,
      applicationId: applicationId,
      namespace: namespace,
      raw: payload
    };
    
    // SECURITY: Service tokens with scopes (from iam_application) can mutate resources
    // Service tokens without scopes are READ ONLY + whitelisted POST
    if (actor.type === 'service_token' && method !== 'GET') {
      const hasScopes = actor.scopes && actor.scopes.length > 0;
      const isSafePost = method === 'POST' && SERVICE_TOKEN_SAFE_POSTS.includes(url.pathname);
      
      if (!hasScopes && !isSafePost) {
        return { 
          valid: false, 
          error: `Service tokens without scopes have READ ONLY access. Method ${method} not allowed. Link token to an application for write access.`,
          code: 'FORBIDDEN'
        };
      }
      
      // If has scopes, authorization will be checked in handlers (per-resource based on namespace)
    }
    
    // SECURITY: Allow self-service routes for all authenticated users
    const isSelfService = USER_SELF_SERVICE_PATTERNS.some(
      r => r.method === method && r.pattern.test(url.pathname)
    );
    if (actor.type === 'user' && isSelfService) {
      return { valid: true, actor };  // Le handler verifie ownership
    }
    
    // SECURITY: Non-admin users are also READ ONLY
    if (actor.type === 'user' && actor.role === 'reader' && method !== 'GET') {
      return { 
        valid: false, 
        error: `User ${actor.id} has READ ONLY access. Admin role required for ${method}.`,
        code: 'FORBIDDEN'
      };
    }
    
    return { valid: true, actor };
  } catch (err) {
    return { valid: false, error: `JWT validation error: ${err.message}` };
  }
}

/**
 * Check authorization result and return appropriate error
 */
export function checkAuth(auth) {
  if (!auth.valid) {
    const status = auth.code === 'FORBIDDEN' ? 403 : 401;
    return error(auth.error, status, auth.code || 'UNAUTHORIZED');
  }
  return null;
}

/**
 * Auth middleware wrapper
 */
export function withAuth(handler) {
  return async (request, env, ctx) => {
    const auth = await validateAccess(request, env);
    
    const authError = checkAuth(auth);
    if (authError) return authError;
    
    // Add actor to context
    ctx.actor = auth.actor;
    return handler(request, env, ctx);
  };
}
