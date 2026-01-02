/**
 * Application Management Handlers
 * Enterprise-grade CRUD for TPB applications
 */

import { error, success } from '../utils/response.js';
import { logAudit } from './audit.js';
import { getCfAccessController } from '../services/cfAccess.js';
import { getInfraProvider } from '../services/infraProvider.js';

const DEFAULT_ORG_ID = 'org_tpb';
const VAULT_APP_NAME = 'tpb-vault-infra';

// Valid scope patterns
const SCOPE_PATTERNS = [
  /^[a-z]+:\*$/,                    // namespace:*
  /^[a-z]+:(role|permission|group|user):\*$/,  // namespace:resource:*
  /^[a-z]+:(role|permission|group|user):(create|read|update|delete)$/  // namespace:resource:action
];

function validateScopes(scopes, namespace) {
  for (const scope of scopes) {
    // Scope must start with the namespace
    if (!scope.startsWith(`${namespace}:`)) {
      return { valid: false, error: `Scope "${scope}" must start with "${namespace}:"` };
    }
    // Scope must match valid pattern
    if (!SCOPE_PATTERNS.some(p => p.test(scope))) {
      return { valid: false, error: `Invalid scope format: "${scope}"` };
    }
  }
  return { valid: true };
}

/**
 * List all applications
 * GET /iam/applications
 */
export async function listApplications(request, env, ctx) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT 
        a.*,
        u.display_name as created_by_name
      FROM iam_application a
      LEFT JOIN iam_user u ON a.created_by = u.id
      WHERE a.organization_id = ?
      ORDER BY a.created_at DESC
    `).bind(DEFAULT_ORG_ID).all();
    
    // Parse scopes/audiences and count resources
    const applications = await Promise.all(results.map(async (app) => {
      // Count resources in this namespace
      const [roles, permissions, groups] = await Promise.all([
        env.DB.prepare(`SELECT COUNT(*) as count FROM iam_role WHERE id LIKE ?`).bind(`role_${app.namespace}_%`).first(),
        env.DB.prepare(`SELECT COUNT(*) as count FROM iam_permission WHERE resource LIKE ?`).bind(`${app.namespace}_%`).first(),
        env.DB.prepare(`SELECT COUNT(*) as count FROM iam_group WHERE id LIKE ?`).bind(`grp_${app.namespace}_%`).first()
      ]);
      
      return {
        ...app,
        scopes: app.scopes ? app.scopes.split(',') : [],
        audiences: app.audiences ? JSON.parse(app.audiences) : [],
        resources: {
          roles: roles?.count || 0,
          permissions: permissions?.count || 0,
          groups: groups?.count || 0
        }
      };
    }));
    
    return success({ applications });
  } catch (err) {
    return error(`Failed to list applications: ${err.message}`, 500);
  }
}

/**
 * Get application details
 * GET /iam/applications/:appId
 */
export async function getApplication(request, env, ctx) {
  try {
    const { appId } = ctx.params;
    
    const app = await env.DB.prepare(`
      SELECT a.*, u.display_name as created_by_name
      FROM iam_application a
      LEFT JOIN iam_user u ON a.created_by = u.id
      WHERE a.id = ?
    `).bind(appId).first();
    
    if (!app) {
      return error('Application not found', 404, 'NOT_FOUND');
    }
    
    // Get roles, permissions, groups for this namespace
    const [roles, permissions, groups] = await Promise.all([
      env.DB.prepare(`SELECT id, name, description FROM iam_role WHERE id LIKE ?`).bind(`role_${app.namespace}_%`).all(),
      env.DB.prepare(`SELECT id, action, resource, description FROM iam_permission WHERE resource LIKE ?`).bind(`${app.namespace}_%`).all(),
      env.DB.prepare(`SELECT id, name, description FROM iam_group WHERE id LIKE ?`).bind(`grp_${app.namespace}_%`).all()
    ]);
    
    // Get audience states from infra
    const audiences = app.audiences ? JSON.parse(app.audiences) : [];
    let audienceStates = [];
    if (audiences.length > 0) {
      const infraProvider = getInfraProvider(env);
      audienceStates = await Promise.all(
        audiences.map(async (aud) => {
          const state = await infraProvider.getAudienceState(aud);
          return { audience: aud, ...state };
        })
      );
    }
    
    return success({
      application: {
        ...app,
        scopes: app.scopes ? app.scopes.split(',') : [],
        audiences,
        audienceStates,
        resources: {
          roles: roles.results || [],
          permissions: permissions.results || [],
          groups: groups.results || []
        }
      }
    });
  } catch (err) {
    return error(`Failed to get application: ${err.message}`, 500);
  }
}

/**
 * Register a new application
 * POST /iam/applications
 * 
 * Only superadmin can register applications.
 * 
 * Body:
 * - name: Application name (becomes namespace)
 * - scopes: IAM scopes for the application's service token
 * - audiences: (optional) CF Access apps this application protects
 */
export async function createApplication(request, env, ctx) {
  try {
    // Guard: Only superadmin
    if (ctx.actor?.role !== 'superadmin') {
      return error('Superadmin privileges required', 403, 'FORBIDDEN');
    }
    
    const body = await request.json();
    const { 
      name, 
      display_name, 
      description, 
      scopes = [],
      audiences = [],  // NEW: OAuth-style audiences
      icon_url,
      homepage_url,
      contact_email
    } = body;
    
    // Validation
    if (!name || !name.match(/^[a-z][a-z0-9_]{2,20}$/)) {
      return error('name must be lowercase alphanumeric (3-20 chars)', 400, 'INVALID_NAME');
    }
    
    const namespace = name; // namespace = name
    
    // Validate scopes
    if (!scopes.length) {
      return error('At least one scope is required', 400, 'MISSING_SCOPES');
    }
    
    const scopeValidation = validateScopes(scopes, namespace);
    if (!scopeValidation.valid) {
      return error(scopeValidation.error, 400, 'INVALID_SCOPES');
    }
    
    // Validate audiences (if provided)
    if (audiences.length > 0) {
      for (const aud of audiences) {
        if (typeof aud !== 'string' || !aud.match(/^[a-z0-9-]+$/)) {
          return error(`Invalid audience "${aud}". Must be lowercase alphanumeric with hyphens.`, 400, 'INVALID_AUDIENCE');
        }
      }
    }
    
    // Check if exists
    const existing = await env.DB.prepare(
      'SELECT id FROM iam_application WHERE name = ? OR namespace = ?'
    ).bind(name, namespace).first();
    
    if (existing) {
      return error(`Application "${name}" already exists`, 409, 'EXISTS');
    }
    
    // Create service token in Cloudflare
    let serviceToken;
    try {
      const cf = getCfAccessController(env);
      serviceToken = await cf.createServiceTokenWithAccess(`app-${name}`, VAULT_APP_NAME);
    } catch (err) {
      console.error('CF API error:', err);
      return error(`Failed to create service account: ${err.message}`, 502, 'CLOUDFLARE_ERROR');
    }
    
    // Generate IDs
    const appId = `app_${name}`;
    const now = new Date().toISOString();
    
    // D1 requires null instead of undefined for nullable fields
    const safeDescription = description ?? null;
    const safeIconUrl = icon_url ?? null;
    const safeHomepageUrl = homepage_url ?? null;
    const safeContactEmail = contact_email ?? null;
    const safeActorId = ctx.actor?.id ?? null;
    const safeAudiences = audiences.length > 0 ? JSON.stringify(audiences) : null;
    
    // Insert application (with audiences)
    await env.DB.prepare(`
      INSERT INTO iam_application (
        id, organization_id, name, display_name, description, namespace, scopes, audiences,
        cf_token_id, credentials_last_rotated_at, icon_url, homepage_url, contact_email,
        status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `).bind(
      appId, DEFAULT_ORG_ID, name, display_name || name, safeDescription,
      namespace, scopes.join(','), safeAudiences,
      serviceToken.tokenId, now, safeIconUrl, safeHomepageUrl, safeContactEmail,
      safeActorId, now, now
    ).run();
    
    // Also create a record in iam_service_token
    await env.DB.prepare(`
      INSERT INTO iam_service_token (
        id, organization_id, cf_token_id, cf_client_id, subject_email, name, application_id, scopes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      DEFAULT_ORG_ID,
      serviceToken.tokenId,
      serviceToken.clientId,  // Store client_id for auth lookup
      `app-${name}@system`,
      `app-${name}`,
      appId,
      scopes.join(','),
      now
    ).run();
    
    // Provision audiences via infra provider
    const provisionedAudiences = [];
    if (audiences.length > 0) {
      const infraProvider = getInfraProvider(env);
      for (const audience of audiences) {
        try {
          const result = await infraProvider.provisionAudience(audience, namespace);
          provisionedAudiences.push({ audience, status: 'provisioned', ...result });
        } catch (err) {
          console.error(`Failed to provision audience ${audience}:`, err);
          provisionedAudiences.push({ audience, status: 'error', error: err.message });
        }
      }
    }
    
    // Audit log
    await logAudit(env, {
      action: 'application:create',
      actor_id: safeActorId,
      actor_type: 'user',
      context: {
        application_id: appId,
        name,
        namespace,
        scopes,
        audiences,
        provisionedAudiences
      }
    });
    
    return success({
      application: {
        id: appId,
        name,
        display_name: display_name || name,
        namespace,
        scopes,
        audiences,
        status: 'active',
        created_at: now
      },
      credentials: {
        client_id: serviceToken.clientId,
        client_secret: serviceToken.clientSecret,
        namespace,
        scopes
      },
      audiences: provisionedAudiences,
      env_file: `# TPB Application Credentials - ${display_name || name}
# Generated on ${now}
# Namespace: ${namespace}
# Scopes: ${scopes.join(', ')}
# Audiences: ${audiences.join(', ') || 'none'}

APP_VAULT_CLIENT_ID=${serviceToken.clientId}
APP_VAULT_CLIENT_SECRET=${serviceToken.clientSecret}
APP_NAMESPACE=${namespace}`,
      warning: '⚠️ Store these credentials securely. The secret will NOT be shown again.'
    }, 201);
    
  } catch (err) {
    console.error('Create application error:', err);
    return error(`Failed to create application: ${err.message}`, 500);
  }
}

/**
 * Update application
 * PATCH /iam/applications/:appId
 */
export async function updateApplication(request, env, ctx) {
  try {
    if (ctx.actor?.role !== 'superadmin') {
      return error('Superadmin privileges required', 403, 'FORBIDDEN');
    }
    
    const { appId } = ctx.params;
    const body = await request.json();
    const { display_name, description, scopes, icon_url, homepage_url, contact_email, status } = body;
    
    const app = await env.DB.prepare('SELECT * FROM iam_application WHERE id = ?').bind(appId).first();
    if (!app) {
      return error('Application not found', 404, 'NOT_FOUND');
    }
    
    // Validate scopes if provided
    if (scopes) {
      const scopeValidation = validateScopes(scopes, app.namespace);
      if (!scopeValidation.valid) {
        return error(scopeValidation.error, 400, 'INVALID_SCOPES');
      }
    }
    
    // Build update query
    const updates = [];
    const values = [];
    
    if (display_name !== undefined) { updates.push('display_name = ?'); values.push(display_name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (scopes) { updates.push('scopes = ?'); values.push(scopes.join(',')); }
    if (icon_url !== undefined) { updates.push('icon_url = ?'); values.push(icon_url); }
    if (homepage_url !== undefined) { updates.push('homepage_url = ?'); values.push(homepage_url); }
    if (contact_email !== undefined) { updates.push('contact_email = ?'); values.push(contact_email); }
    if (status) { updates.push('status = ?'); values.push(status); }
    
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(appId);
    
    await env.DB.prepare(`
      UPDATE iam_application SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();
    
    // Update scopes in service token too
    if (scopes) {
      await env.DB.prepare(`
        UPDATE iam_service_token SET scopes = ? WHERE application_id = ?
      `).bind(scopes.join(','), appId).run();
    }
    
    await logAudit(env, {
      action: 'application:update',
      actor_id: ctx.actor?.id,
      actor_type: 'user',
      context: { application_id: appId, changes: body }
    });
    
    return success({ message: 'Application updated' });
  } catch (err) {
    return error(`Failed to update application: ${err.message}`, 500);
  }
}

/**
 * Rotate application credentials
 * POST /iam/applications/:appId/rotate-credentials
 */
export async function rotateCredentials(request, env, ctx) {
  try {
    if (ctx.actor?.role !== 'superadmin') {
      return error('Superadmin privileges required', 403, 'FORBIDDEN');
    }
    
    const { appId } = ctx.params;
    
    const app = await env.DB.prepare('SELECT * FROM iam_application WHERE id = ?').bind(appId).first();
    if (!app) {
      return error('Application not found', 404, 'NOT_FOUND');
    }
    
    // Revoke old token
    if (app.cf_token_id) {
      try {
        const cf = getCfAccessController(env);
        await cf.revokeServiceTokenWithAccess(app.cf_token_id, VAULT_APP_NAME);
      } catch (err) {
        console.warn('Failed to revoke old token:', err);
      }
    }
    
    // Create new token
    const cf = getCfAccessController(env);
    const newToken = await cf.createServiceTokenWithAccess(`app-${app.name}`, VAULT_APP_NAME);
    
    const now = new Date().toISOString();
    
    // Update application
    await env.DB.prepare(`
      UPDATE iam_application 
      SET cf_token_id = ?, credentials_last_rotated_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(newToken.tokenId, now, now, appId).run();
    
    // Update service token record
    await env.DB.prepare(`
      UPDATE iam_service_token SET cf_token_id = ? WHERE application_id = ?
    `).bind(newToken.tokenId, appId).run();
    
    await logAudit(env, {
      action: 'application:rotate_credentials',
      actor_id: ctx.actor?.id,
      actor_type: 'user',
      context: { application_id: appId }
    });
    
    return success({
      credentials: {
        client_id: newToken.clientId,
        client_secret: newToken.clientSecret
      },
      rotated_at: now,
      warning: '⚠️ Update your application configuration immediately. The old credentials are now revoked.'
    });
    
  } catch (err) {
    return error(`Failed to rotate credentials: ${err.message}`, 500);
  }
}

/**
 * Delete/revoke application
 * DELETE /iam/applications/:appId
 */
export async function deleteApplication(request, env, ctx) {
  try {
    if (ctx.actor?.role !== 'superadmin') {
      return error('Superadmin privileges required', 403, 'FORBIDDEN');
    }
    
    const { appId } = ctx.params;
    
    const app = await env.DB.prepare('SELECT * FROM iam_application WHERE id = ?').bind(appId).first();
    if (!app) {
      return error('Application not found', 404, 'NOT_FOUND');
    }
    
    // Option: soft delete (change status) or hard delete
    // For safety, we soft delete
    await env.DB.prepare(`
      UPDATE iam_application SET status = 'revoked', updated_at = ? WHERE id = ?
    `).bind(new Date().toISOString(), appId).run();
    
    // Revoke service token
    if (app.cf_token_id) {
      try {
        const cf = getCfAccessController(env);
        await cf.revokeServiceTokenWithAccess(app.cf_token_id, VAULT_APP_NAME);
      } catch (err) {
        console.warn('Failed to revoke token:', err);
      }
    }
    
    // Mark service token as revoked
    await env.DB.prepare(`
      UPDATE iam_service_token SET revoked_at = ? WHERE application_id = ?
    `).bind(new Date().toISOString(), appId).run();
    
    await logAudit(env, {
      action: 'application:revoke',
      actor_id: ctx.actor?.id,
      actor_type: 'user',
      context: { application_id: appId, name: app.name }
    });
    
    return success({ message: `Application "${app.name}" has been revoked` });
    
  } catch (err) {
    return error(`Failed to delete application: ${err.message}`, 500);
  }
}

/**
 * Sync audiences - reconcile infrastructure with vault state
 * POST /iam/applications/:appId/sync-audiences
 */
export async function syncAudiences(request, env, ctx) {
  try {
    if (ctx.actor?.role !== 'superadmin') {
      return error('Superadmin privileges required', 403, 'FORBIDDEN');
    }
    
    const { appId } = ctx.params;
    
    const app = await env.DB.prepare('SELECT * FROM iam_application WHERE id = ?').bind(appId).first();
    if (!app) {
      return error('Application not found', 404, 'NOT_FOUND');
    }
    
    const audiences = app.audiences ? JSON.parse(app.audiences) : [];
    if (audiences.length === 0) {
      return success({ message: 'No audiences to sync', synced: [] });
    }
    
    // Get all members from groups in this namespace
    const { results: groupMembers } = await env.DB.prepare(`
      SELECT DISTINCT u.email
      FROM iam_user u
      JOIN iam_group_membership gm ON u.id = gm.user_id
      JOIN iam_group g ON gm.group_id = g.id
      WHERE g.id LIKE ?
    `).bind(`grp_${app.namespace}_%`).all();
    
    const emails = groupMembers.map(m => m.email);
    
    // Sync to infrastructure
    const infraProvider = getInfraProvider(env);
    const syncResults = [];
    
    for (const audience of audiences) {
      try {
        // Ensure audience is provisioned
        await infraProvider.provisionAudience(audience, app.namespace);
        // Sync members
        const result = await infraProvider.syncMembers(audience, emails);
        syncResults.push({ audience, status: 'synced', members: emails.length, ...result });
      } catch (err) {
        syncResults.push({ audience, status: 'error', error: err.message });
      }
    }
    
    await logAudit(env, {
      action: 'application:sync_audiences',
      actor_id: ctx.actor?.id,
      actor_type: 'user',
      context: {
        application_id: appId,
        namespace: app.namespace,
        audiences,
        members_synced: emails.length
      }
    });
    
    return success({
      application_id: appId,
      namespace: app.namespace,
      members: emails,
      synced: syncResults
    });
    
  } catch (err) {
    return error(`Failed to sync audiences: ${err.message}`, 500);
  }
}

/**
 * List orphan infrastructure resources
 * GET /iam/applications/orphans
 */
export async function listOrphanResources(request, env, ctx) {
  try {
    if (ctx.actor?.role !== 'superadmin' && ctx.actor?.role !== 'admin') {
      return error('Admin privileges required', 403, 'FORBIDDEN');
    }
    
    const infraProvider = getInfraProvider(env);
    const orphans = await infraProvider.listOrphanResources();
    
    return success({
      orphans,
      count: orphans.length,
      message: orphans.length > 0 
        ? 'Found infrastructure resources not tracked by vault. Consider cleanup.'
        : 'No orphan resources found.'
    });
    
  } catch (err) {
    return error(`Failed to list orphans: ${err.message}`, 500);
  }
}

