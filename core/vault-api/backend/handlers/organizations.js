/**
 * Organization Management Handlers
 * Multi-tenant support for vault-api IAM
 */

import { json, error, success, generateId } from '../utils/response.js';
import { logAudit } from './audit.js';

// Default organization for TPB
const DEFAULT_ORG_ID = 'org_tpb';

/**
 * List all organizations (superadmin only)
 * GET /iam/organizations
 */
export async function listOrganizations(request, env, ctx) {
  try {
    const actor = ctx.actor;
    
    // Service tokens can only see the default org (their org)
    if (actor?.type === 'service_token') {
      const { results } = await env.DB.prepare(`
        SELECT * FROM iam_organization WHERE id = ?
      `).bind(DEFAULT_ORG_ID).all();
      return success({ organizations: results });
    }
    
    // Users: check if superadmin
    if (actor?.type === 'user') {
      const isSuperadmin = await checkSuperadmin(env, actor.id);
      if (!isSuperadmin) {
        // Non-superadmins only see their own org
        const { results } = await env.DB.prepare(`
          SELECT o.* FROM iam_organization o
          JOIN iam_user u ON u.organization_id = o.id
          WHERE u.id = ?
        `).bind(actor.id).all();
        return success({ organizations: results });
      }
      
      // Superadmin sees all
      const { results } = await env.DB.prepare(`
        SELECT * FROM iam_organization ORDER BY created_at DESC
      `).all();
      return success({ organizations: results });
    }
    
    return error('Authentication required', 401, 'UNAUTHORIZED');
  } catch (err) {
    return error(`Failed to list organizations: ${err.message}`, 500);
  }
}

/**
 * Get organization by ID
 * GET /iam/organizations/:orgId
 */
export async function getOrganization(request, env, ctx) {
  const { orgId } = ctx.params;
  
  try {
    const org = await env.DB.prepare(`
      SELECT * FROM iam_organization WHERE id = ?
    `).bind(orgId).first();
    
    if (!org) {
      return error(`Organization '${orgId}' not found`, 404, 'NOT_FOUND');
    }
    
    // Get stats
    const stats = await env.DB.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM iam_user WHERE organization_id = ?) as users,
        (SELECT COUNT(*) FROM iam_group WHERE organization_id = ?) as groups,
        (SELECT COUNT(*) FROM connection WHERE organization_id = ?) as connections
    `).bind(orgId, orgId, orgId).first();
    
    return success({ 
      organization: {
        ...org,
        settings: org.settings_json ? JSON.parse(org.settings_json) : null
      },
      stats 
    });
  } catch (err) {
    return error(`Failed to get organization: ${err.message}`, 500);
  }
}

/**
 * Create new organization
 * POST /iam/organizations
 */
export async function createOrganization(request, env, ctx) {
  try {
    const body = await request.json();
    const { name, slug, cf_account_id, settings } = body;
    
    if (!name || !slug) {
      return error('name and slug are required', 400, 'VALIDATION_ERROR');
    }
    
    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return error('slug must be lowercase alphanumeric with hyphens only', 400, 'VALIDATION_ERROR');
    }
    
    // Check slug uniqueness
    const existing = await env.DB.prepare(
      'SELECT id FROM iam_organization WHERE slug = ?'
    ).bind(slug).first();
    
    if (existing) {
      return error(`Organization with slug '${slug}' already exists`, 409, 'CONFLICT');
    }
    
    const id = generateId('org');
    const settingsJson = settings ? JSON.stringify(settings) : null;
    
    await env.DB.prepare(`
      INSERT INTO iam_organization (id, name, slug, cf_account_id, settings_json)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, name, slug, cf_account_id || null, settingsJson).run();
    
    // Audit log
    await logAudit(env, {
      action: 'organization:create',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context: { organization_id: id, slug }
    });
    
    const org = await env.DB.prepare(
      'SELECT * FROM iam_organization WHERE id = ?'
    ).bind(id).first();
    
    return json({ success: true, organization: org }, 201);
  } catch (err) {
    return error(`Failed to create organization: ${err.message}`, 500);
  }
}

/**
 * Update organization
 * PATCH /iam/organizations/:orgId
 */
export async function updateOrganization(request, env, ctx) {
  const { orgId } = ctx.params;
  
  try {
    const existing = await env.DB.prepare(
      'SELECT * FROM iam_organization WHERE id = ?'
    ).bind(orgId).first();
    
    if (!existing) {
      return error(`Organization '${orgId}' not found`, 404, 'NOT_FOUND');
    }
    
    const body = await request.json();
    const { name, cf_account_id, settings } = body;
    
    // Build update
    const updates = [];
    const bindings = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      bindings.push(name);
    }
    if (cf_account_id !== undefined) {
      updates.push('cf_account_id = ?');
      bindings.push(cf_account_id);
    }
    if (settings !== undefined) {
      updates.push('settings_json = ?');
      bindings.push(JSON.stringify(settings));
    }
    
    if (updates.length === 0) {
      return error('No fields to update', 400, 'VALIDATION_ERROR');
    }
    
    updates.push('updated_at = datetime(\'now\')');
    bindings.push(orgId);
    
    await env.DB.prepare(`
      UPDATE iam_organization SET ${updates.join(', ')} WHERE id = ?
    `).bind(...bindings).run();
    
    // Audit log
    await logAudit(env, {
      action: 'organization:update',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context: { organization_id: orgId, updated_fields: Object.keys(body) }
    });
    
    const org = await env.DB.prepare(
      'SELECT * FROM iam_organization WHERE id = ?'
    ).bind(orgId).first();
    
    return success({ organization: org });
  } catch (err) {
    return error(`Failed to update organization: ${err.message}`, 500);
  }
}

/**
 * Delete organization
 * DELETE /iam/organizations/:orgId
 */
export async function deleteOrganization(request, env, ctx) {
  const { orgId } = ctx.params;
  
  try {
    // Prevent deleting default org
    if (orgId === DEFAULT_ORG_ID) {
      return error('Cannot delete default organization', 400, 'FORBIDDEN');
    }
    
    const existing = await env.DB.prepare(
      'SELECT * FROM iam_organization WHERE id = ?'
    ).bind(orgId).first();
    
    if (!existing) {
      return error(`Organization '${orgId}' not found`, 404, 'NOT_FOUND');
    }
    
    // Check for resources
    const stats = await env.DB.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM iam_user WHERE organization_id = ?) as users,
        (SELECT COUNT(*) FROM connection WHERE organization_id = ?) as connections
    `).bind(orgId, orgId).first();
    
    if (stats.users > 0 || stats.connections > 0) {
      return error(
        `Cannot delete organization with ${stats.users} users and ${stats.connections} connections. Remove them first.`,
        400,
        'HAS_DEPENDENCIES'
      );
    }
    
    // Delete groups first (they have no FK cascade from org)
    await env.DB.prepare(
      'DELETE FROM iam_group WHERE organization_id = ?'
    ).bind(orgId).run();
    
    // Delete custom roles
    await env.DB.prepare(
      'DELETE FROM iam_role WHERE organization_id = ? AND is_system = 0'
    ).bind(orgId).run();
    
    // Delete organization
    await env.DB.prepare(
      'DELETE FROM iam_organization WHERE id = ?'
    ).bind(orgId).run();
    
    // Audit log
    await logAudit(env, {
      action: 'organization:delete',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context: { organization_id: orgId, slug: existing.slug }
    });
    
    return success({ deleted: true, organization_id: orgId });
  } catch (err) {
    return error(`Failed to delete organization: ${err.message}`, 500);
  }
}

/**
 * Get organization members (users)
 * GET /iam/organizations/:orgId/members
 */
export async function getOrganizationMembers(request, env, ctx) {
  const { orgId } = ctx.params;
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  
  try {
    let query = `
      SELECT 
        u.*,
        GROUP_CONCAT(g.name) as groups
      FROM iam_user u
      LEFT JOIN iam_user_group ug ON u.id = ug.user_id
      LEFT JOIN iam_group g ON ug.group_id = g.id
      WHERE u.organization_id = ?
    `;
    const bindings = [orgId];
    
    if (status) {
      query += ' AND u.status = ?';
      bindings.push(status);
    }
    
    query += ' GROUP BY u.id ORDER BY u.created_at DESC';
    
    const { results } = await env.DB.prepare(query).bind(...bindings).all();
    
    const members = results.map(m => ({
      ...m,
      groups: m.groups ? m.groups.split(',') : []
    }));
    
    return success({ members });
  } catch (err) {
    return error(`Failed to get members: ${err.message}`, 500);
  }
}

/**
 * Get organization audit log
 * GET /iam/organizations/:orgId/audit
 */
export async function getOrganizationAudit(request, env, ctx) {
  const { orgId } = ctx.params;
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  try {
    // Get audit entries related to this org
    const { results } = await env.DB.prepare(`
      SELECT * FROM sys_audit_log 
      WHERE context_json LIKE ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(`%"organization_id":"${orgId}"%`, limit, offset).all();
    
    const logs = results.map(log => ({
      ...log,
      context: log.context_json ? JSON.parse(log.context_json) : null
    }));
    
    return success({ logs });
  } catch (err) {
    return error(`Failed to get audit log: ${err.message}`, 500);
  }
}

// Helper: Check if user is superadmin
async function checkSuperadmin(env, userId) {
  const result = await env.DB.prepare(`
    SELECT 1 FROM iam_user_group ug
    JOIN iam_group_role gr ON ug.group_id = gr.group_id
    JOIN iam_role r ON gr.role_id = r.id
    WHERE ug.user_id = ? AND r.name = 'superadmin'
    LIMIT 1
  `).bind(userId).first();
  
  return !!result;
}

