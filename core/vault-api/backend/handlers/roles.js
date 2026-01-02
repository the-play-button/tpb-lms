/**
 * IAM Role & Permission Management Handlers
 */

import { error, success } from '../utils/response.js';
import { logAudit } from './audit.js';

const DEFAULT_ORG_ID = 'org_tpb';

/**
 * List roles (system + org-specific)
 * GET /iam/roles
 */
export async function listRoles(request, env, ctx) {
  try {
    const orgId = DEFAULT_ORG_ID;
    
    const { results } = await env.DB.prepare(`
      SELECT r.*,
             (SELECT GROUP_CONCAT(p.action || ':' || p.resource) 
              FROM iam_role_permission rp 
              JOIN iam_permission p ON rp.permission_id = p.id
              WHERE rp.role_id = r.id) as permissions
      FROM iam_role r
      WHERE r.organization_id IS NULL OR r.organization_id = ?
      ORDER BY r.is_system DESC, r.name
    `).bind(orgId).all();
    
    const roles = results.map(r => ({
      ...r,
      permissions: r.permissions ? r.permissions.split(',') : []
    }));
    
    return success({ roles });
  } catch (err) {
    return error(`Failed to list roles: ${err.message}`, 500);
  }
}

/**
 * Create custom role
 * POST /iam/roles
 * 
 * Can be called by:
 * - Superadmin/Admin (unrestricted)
 * - Service tokens with appropriate scopes (namespace-restricted)
 */
export async function createRole(request, env, ctx) {
  try {
    const body = await request.json();
    const { name, description, permissions = [] } = body;
    
    if (!name) {
      return error('name is required', 400, 'MISSING_FIELD');
    }
    
    const orgId = DEFAULT_ORG_ID;
    const roleId = `role_${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
    
    // Validate namespace for service accounts (applications)
    if (ctx.actor?.type === 'service_token' && ctx.actor?.scopes) {
      const namespace = ctx.actor.namespace;
      const hasScope = ctx.actor.scopes.some(s => 
        s === `${namespace}:*` || 
        s === `${namespace}:role:*` ||
        s === `${namespace}:role:create`
      );
      
      if (!hasScope) {
        return error(`Missing scope: ${namespace}:role:create`, 403, 'FORBIDDEN');
      }
      
      // Verify role name matches namespace
      if (!name.toLowerCase().startsWith(`${namespace}_`)) {
        return error(`Role name must start with namespace "${namespace}_"`, 403, 'NAMESPACE_VIOLATION');
      }
    } else if (ctx.actor?.role !== 'superadmin' && ctx.actor?.role !== 'admin') {
      return error('Admin privileges required', 403, 'FORBIDDEN');
    }
    
    // Check if exists
    const existing = await env.DB.prepare(
      'SELECT id FROM iam_role WHERE id = ?'
    ).bind(roleId).first();
    
    if (existing) {
      return error(`Role '${name}' already exists`, 409, 'EXISTS');
    }
    
    await env.DB.prepare(`
      INSERT INTO iam_role (id, organization_id, name, description, is_system)
      VALUES (?, ?, ?, ?, 0)
    `).bind(roleId, orgId, name, description || null).run();
    
    // Add permissions
    for (const permId of permissions) {
      await env.DB.prepare(`
        INSERT OR IGNORE INTO iam_role_permission (role_id, permission_id) VALUES (?, ?)
      `).bind(roleId, permId).run();
    }
    
    await logAudit(env, {
      action: 'role:create',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ role_id: roleId, name, permissions })
    });
    
    return success({ role: { id: roleId, name, permissions } }, 201);
  } catch (err) {
    return error(`Failed to create role: ${err.message}`, 500);
  }
}

/**
 * Get role with permissions
 * GET /iam/roles/:roleId
 */
export async function getRole(request, env, ctx) {
  try {
    const { roleId } = ctx.params;
    
    const role = await env.DB.prepare(`
      SELECT * FROM iam_role WHERE id = ?
    `).bind(roleId).first();
    
    if (!role) {
      return error('Role not found', 404, 'NOT_FOUND');
    }
    
    // Get permissions
    const { results: permissions } = await env.DB.prepare(`
      SELECT p.id, p.action, p.resource, p.description
      FROM iam_permission p
      JOIN iam_role_permission rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
    `).bind(roleId).all();
    
    role.permissions = permissions;
    
    // Get groups with this role
    const { results: groups } = await env.DB.prepare(`
      SELECT g.id, g.name
      FROM iam_group g
      JOIN iam_group_role gr ON g.id = gr.group_id
      WHERE gr.role_id = ?
    `).bind(roleId).all();
    
    role.groups = groups;
    
    return success({ role });
  } catch (err) {
    return error(`Failed to get role: ${err.message}`, 500);
  }
}

/**
 * Add permission to role
 * POST /iam/roles/:roleId/permissions
 */
export async function addPermission(request, env, ctx) {
  try {
    const { roleId } = ctx.params;
    const body = await request.json();
    const { permission_id } = body;
    
    if (!permission_id) {
      return error('permission_id is required', 400, 'MISSING_FIELD');
    }
    
    // Check role exists and is not system
    const role = await env.DB.prepare('SELECT id, is_system FROM iam_role WHERE id = ?').bind(roleId).first();
    if (!role) {
      return error('Role not found', 404, 'NOT_FOUND');
    }
    if (role.is_system) {
      return error('Cannot modify system roles', 403, 'FORBIDDEN');
    }
    
    await env.DB.prepare(`
      INSERT INTO iam_role_permission (role_id, permission_id) VALUES (?, ?)
    `).bind(roleId, permission_id).run();
    
    return success({ message: 'Permission added' });
  } catch (err) {
    if (err.message.includes('UNIQUE') || err.message.includes('PRIMARY')) {
      return error('Permission already assigned', 409, 'EXISTS');
    }
    return error(`Failed to add permission: ${err.message}`, 500);
  }
}

/**
 * Remove permission from role
 * DELETE /iam/roles/:roleId/permissions/:permissionId
 */
export async function removePermission(request, env, ctx) {
  try {
    const { roleId, permissionId } = ctx.params;
    
    // Check role is not system
    const role = await env.DB.prepare('SELECT is_system FROM iam_role WHERE id = ?').bind(roleId).first();
    if (role?.is_system) {
      return error('Cannot modify system roles', 403, 'FORBIDDEN');
    }
    
    await env.DB.prepare(`
      DELETE FROM iam_role_permission WHERE role_id = ? AND permission_id = ?
    `).bind(roleId, permissionId).run();
    
    return success({ message: 'Permission removed' });
  } catch (err) {
    return error(`Failed to remove permission: ${err.message}`, 500);
  }
}

/**
 * List all permissions
 * GET /iam/permissions
 */
export async function listPermissions(request, env, ctx) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT * FROM iam_permission ORDER BY resource, action
    `).all();
    
    return success({ permissions: results });
  } catch (err) {
    return error(`Failed to list permissions: ${err.message}`, 500);
  }
}

/**
 * Create permission
 * POST /iam/permissions
 * 
 * Can be called by:
 * - Superadmin/Admin (unrestricted)
 * - Service tokens with appropriate scopes (namespace-restricted)
 */
export async function createPermission(request, env, ctx) {
  try {
    const body = await request.json();
    const { action, resource, description } = body;
    
    if (!action || !resource) {
      return error('action and resource are required', 400, 'MISSING_FIELD');
    }
    
    // Validate namespace for service accounts (applications)
    if (ctx.actor?.type === 'service_token' && ctx.actor?.scopes) {
      const namespace = resource.split('_')[0];
      const hasScope = ctx.actor.scopes.some(s => 
        s === `${namespace}:*` || 
        s === `${namespace}:permission:*` ||
        s === `${namespace}:permission:create`
      );
      
      if (!hasScope) {
        return error(`Missing scope: ${namespace}:permission:create`, 403, 'FORBIDDEN');
      }
      
      // Also verify resource matches namespace
      if (!resource.startsWith(`${ctx.actor.namespace}_`)) {
        return error(`Resource must start with namespace "${ctx.actor.namespace}_"`, 403, 'NAMESPACE_VIOLATION');
      }
    } else if (ctx.actor?.role !== 'superadmin' && ctx.actor?.role !== 'admin') {
      return error('Admin privileges required', 403, 'FORBIDDEN');
    }
    
    const permId = `perm_${action}_${resource}`;
    
    // Check if exists
    const existing = await env.DB.prepare('SELECT id FROM iam_permission WHERE id = ?').bind(permId).first();
    if (existing) {
      return error(`Permission "${permId}" already exists`, 409, 'EXISTS');
    }
    
    await env.DB.prepare(`
      INSERT INTO iam_permission (id, action, resource, description)
      VALUES (?, ?, ?, ?)
    `).bind(permId, action, resource, description || null).run();
    
    await logAudit(env, {
      action: 'permission:create',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context: { permission_id: permId, action, resource }
    });
    
    return success({ permission: { id: permId, action, resource, description } }, 201);
    
  } catch (err) {
    return error(`Failed to create permission: ${err.message}`, 500);
  }
}

