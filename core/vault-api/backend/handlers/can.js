/**
 * CASL Authorization Handlers
 * 
 * Centralized authorization - apps call /iam/can to check permissions.
 * vault-api is SSOT for authorization decisions.
 */

import { error, success } from '../utils/response.js';

/**
 * Get user's permissions from groups -> roles -> permissions
 */
async function getUserPermissions(env, userId) {
  const { results } = await env.DB.prepare(`
    SELECT DISTINCT p.action, p.resource
    FROM iam_user u
    JOIN iam_user_group ug ON u.id = ug.user_id
    JOIN iam_group_role gr ON ug.group_id = gr.group_id
    JOIN iam_role_permission rp ON gr.role_id = rp.role_id
    JOIN iam_permission p ON rp.permission_id = p.id
    WHERE u.id = ? AND u.status = 'active'
  `).bind(userId).all();
  
  return results;
}

/**
 * Get user ID from email
 */
export async function getUserIdFromEmail(env, email) {
  const user = await env.DB.prepare(
    'SELECT id FROM iam_user WHERE email = ? AND status = ?'
  ).bind(email, 'active').first();
  
  return user?.id;
}

/**
 * Check if user can perform action on resource
 */
function canPerform(permissions, action, resource) {
  for (const perm of permissions) {
    // Check for wildcard permission
    if (perm.action === 'manage' && perm.resource === '*') {
      return { allowed: true, reason: 'manage:*' };
    }
    
    // Check for matching resource with manage
    if (perm.action === 'manage' && perm.resource === resource) {
      return { allowed: true, reason: `manage:${resource}` };
    }
    
    // Check exact match
    if (perm.action === action && perm.resource === resource) {
      return { allowed: true, reason: `${action}:${resource}` };
    }
    
    // Check resource wildcard
    if (perm.action === action && perm.resource === '*') {
      return { allowed: true, reason: `${action}:*` };
    }
  }
  
  return { allowed: false, reason: 'no matching permission' };
}

/**
 * Check authorization
 * POST /iam/can
 * 
 * Body: { action, resource, resource_id?, user_id? }
 * 
 * If user_id not provided, uses the authenticated user.
 */
export async function checkCan(request, env, ctx) {
  try {
    const body = await request.json();
    const { action, resource, resource_id, user_id } = body;
    
    if (!action || !resource) {
      return error('action and resource are required', 400, 'MISSING_FIELD');
    }
    
    // Get user ID
    let targetUserId = user_id;
    if (!targetUserId && ctx.actor?.id) {
      targetUserId = await getUserIdFromEmail(env, ctx.actor.id);
    }
    
    if (!targetUserId) {
      return success({
        allowed: false,
        user_id: null,
        action,
        resource,
        resource_id,
        reason: 'user not found in IAM'
      });
    }
    
    // Get permissions
    const permissions = await getUserPermissions(env, targetUserId);
    
    // Check
    const result = canPerform(permissions, action, resource);
    
    return success({
      allowed: result.allowed,
      user_id: targetUserId,
      action,
      resource,
      resource_id,
      reason: result.reason,
      permissions_count: permissions.length
    });
  } catch (err) {
    return error(`Authorization check failed: ${err.message}`, 500);
  }
}

/**
 * Get current user's full ability set
 * GET /iam/me/abilities
 * 
 * Returns all permissions for client-side caching.
 */
export async function getMyAbilities(request, env, ctx) {
  try {
    // Get user ID from actor
    const userId = await getUserIdFromEmail(env, ctx.actor?.id);
    
    if (!userId) {
      return error('User not found in IAM', 404, 'NOT_FOUND');
    }
    
    // Get permissions
    const permissions = await getUserPermissions(env, userId);
    
    // Get user info
    const user = await env.DB.prepare(`
      SELECT id, email, display_name, status FROM iam_user WHERE id = ?
    `).bind(userId).first();
    
    // Get groups
    const { results: groups } = await env.DB.prepare(`
      SELECT g.id, g.name FROM iam_group g
      JOIN iam_user_group ug ON g.id = ug.group_id
      WHERE ug.user_id = ?
    `).bind(userId).all();
    
    // Get roles (via groups)
    const { results: roles } = await env.DB.prepare(`
      SELECT DISTINCT r.id, r.name FROM iam_role r
      JOIN iam_group_role gr ON r.id = gr.role_id
      JOIN iam_user_group ug ON gr.group_id = ug.group_id
      WHERE ug.user_id = ?
    `).bind(userId).all();
    
    // Format permissions as CASL-compatible rules
    const rules = permissions.map(p => ({
      action: p.action,
      subject: p.resource
    }));
    
    // Pre-compute common checks
    const can = {
      'manage:all': canPerform(permissions, 'manage', '*').allowed,
      'read:secret': canPerform(permissions, 'read', 'secret').allowed,
      'write:secret': canPerform(permissions, 'write', 'secret').allowed,
      'manage:user': canPerform(permissions, 'manage', 'user').allowed,
      'manage:group': canPerform(permissions, 'manage', 'group').allowed,
      'create:service_token': canPerform(permissions, 'create', 'service_token').allowed
    };
    
    return success({
      user: {
        id: userId,
        email: user.email,
        display_name: user.display_name,
        status: user.status
      },
      groups,
      roles,
      rules,
      can
    });
  } catch (err) {
    return error(`Failed to get abilities: ${err.message}`, 500);
  }
}

/**
 * Check if current user is admin (for middleware use)
 */
export async function isAdmin(env, actorId) {
  const userId = await getUserIdFromEmail(env, actorId);
  if (!userId) return false;
  
  // Check if user has admin role (not superadmin)
  const result = await env.DB.prepare(`
    SELECT 1 FROM iam_user_group ug
    JOIN iam_group_role gr ON ug.group_id = gr.group_id
    WHERE ug.user_id = ? AND gr.role_id = 'role_admin'
  `).bind(userId).first();
  
  return !!result;
}

/**
 * Check if current user is superadmin (for middleware use)
 */
export async function isSuperAdmin(env, actorId) {
  const userId = await getUserIdFromEmail(env, actorId);
  if (!userId) return false;
  
  // Check if user has superadmin role
  const result = await env.DB.prepare(`
    SELECT 1 FROM iam_user_group ug
    JOIN iam_group_role gr ON ug.group_id = gr.group_id
    WHERE ug.user_id = ? AND gr.role_id = 'role_superadmin'
  `).bind(userId).first();
  
  return !!result;
}

