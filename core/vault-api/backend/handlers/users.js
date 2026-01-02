/**
 * IAM User Management Handlers
 * 
 * CRUD for users with automatic Cloudflare Access policy management.
 * vault-api is SSOT - creating a user here grants CF Access automatically.
 */

import { error, success } from '../utils/response.js';
import { getCfAccessController } from '../services/cfAccess.js';
import { logAudit } from './audit.js';

const VAULT_APP_NAME = 'tpb-vault-infra';
const DEFAULT_ORG_ID = 'org_tpb';

/**
 * List users in organization
 * GET /iam/users
 */
export async function listUsers(request, env, ctx) {
  try {
    const orgId = DEFAULT_ORG_ID;
    
    const { results } = await env.DB.prepare(`
      SELECT u.id, u.email, u.display_name, u.user_type, u.status, 
             u.manager_id, u.cf_policy_id, u.created_at, u.updated_at,
             GROUP_CONCAT(g.name) as groups
      FROM iam_user u
      LEFT JOIN iam_user_group ug ON u.id = ug.user_id
      LEFT JOIN iam_group g ON ug.group_id = g.id
      WHERE u.organization_id = ?
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).bind(orgId).all();
    
    const users = results.map(u => ({
      ...u,
      groups: u.groups ? u.groups.split(',') : []
    }));
    
    return success({ users });
  } catch (err) {
    return error(`Failed to list users: ${err.message}`, 500);
  }
}

/**
 * Create user + auto-grant CF Access to vault-api
 * POST /iam/users
 */
export async function createUser(request, env, ctx) {
  try {
    const body = await request.json();
    const { 
      email, 
      display_name, 
      user_type = 'human', 
      grant_vault_access = true 
    } = body;
    
    if (!email) {
      return error('email is required', 400, 'MISSING_FIELD');
    }
    
    const orgId = DEFAULT_ORG_ID;
    const userId = `usr_${crypto.randomUUID().slice(0, 8)}`;
    
    // Check if exists
    const existing = await env.DB.prepare(
      'SELECT id FROM iam_user WHERE email = ? AND organization_id = ?'
    ).bind(email, orgId).first();
    
    if (existing) {
      return error(`User ${email} already exists`, 409, 'EXISTS');
    }
    
    // Insert user
    await env.DB.prepare(`
      INSERT INTO iam_user (id, organization_id, email, display_name, user_type, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(
      userId, 
      orgId, 
      email, 
      display_name || email.split('@')[0], 
      user_type
    ).run();
    
    // Grant CF Access to vault-api (for human users)
    let cfResult = null;
    if (grant_vault_access && user_type === 'human') {
      try {
        const cf = getCfAccessController(env);
        cfResult = await cf.grantUserAccess(email, VAULT_APP_NAME);
        
        // Store policy ID
        if (cfResult.policyId && !cfResult.alreadyExists) {
          await env.DB.prepare(
            'UPDATE iam_user SET cf_policy_id = ? WHERE id = ?'
          ).bind(cfResult.policyId, userId).run();
        }
      } catch (err) {
        console.error('CF Access grant failed:', err);
        cfResult = { error: err.message };
      }
    }
    
    await logAudit(env, {
      action: 'user:create',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ user_id: userId, email, cf_result: cfResult })
    });
    
    return success({ 
      user: { id: userId, email, status: 'active', display_name: display_name || email.split('@')[0] },
      cf_access: cfResult
    }, 201);
  } catch (err) {
    return error(`Failed to create user: ${err.message}`, 500);
  }
}

/**
 * Get single user
 * GET /iam/users/:userId
 */
export async function getUser(request, env, ctx) {
  try {
    const { userId } = ctx.params;
    
    const user = await env.DB.prepare(`
      SELECT u.*
      FROM iam_user u
      WHERE u.id = ?
    `).bind(userId).first();
    
    if (!user) {
      return error('User not found', 404, 'NOT_FOUND');
    }
    
    // Get groups
    const { results: groups } = await env.DB.prepare(`
      SELECT g.id, g.name, g.type
      FROM iam_group g
      JOIN iam_user_group ug ON g.id = ug.group_id
      WHERE ug.user_id = ?
    `).bind(userId).all();
    
    user.groups = groups;
    
    return success({ user });
  } catch (err) {
    return error(`Failed to get user: ${err.message}`, 500);
  }
}

/**
 * Update user
 * PATCH /iam/users/:userId
 */
export async function updateUser(request, env, ctx) {
  try {
    const { userId } = ctx.params;
    const body = await request.json();
    
    const user = await env.DB.prepare(
      'SELECT id FROM iam_user WHERE id = ?'
    ).bind(userId).first();
    
    if (!user) {
      return error('User not found', 404, 'NOT_FOUND');
    }
    
    const updates = [];
    const values = [];
    
    for (const field of ['display_name', 'status', 'manager_id']) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }
    
    if (updates.length === 0) {
      return error('No fields to update', 400, 'NO_UPDATES');
    }
    
    updates.push("updated_at = datetime('now')");
    values.push(userId);
    
    await env.DB.prepare(`
      UPDATE iam_user SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();
    
    await logAudit(env, {
      action: 'user:update',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ user_id: userId, updates: body })
    });
    
    return success({ message: 'User updated' });
  } catch (err) {
    return error(`Failed to update user: ${err.message}`, 500);
  }
}

/**
 * Delete (suspend) user + revoke CF Access
 * DELETE /iam/users/:userId
 */
export async function deleteUser(request, env, ctx) {
  try {
    const { userId } = ctx.params;
    
    const user = await env.DB.prepare(
      'SELECT email, cf_policy_id FROM iam_user WHERE id = ?'
    ).bind(userId).first();
    
    if (!user) {
      return error('User not found', 404, 'NOT_FOUND');
    }
    
    // Revoke CF Access
    let revokeResult = null;
    try {
      const cf = getCfAccessController(env);
      revokeResult = await cf.revokeUserAccess(user.email, VAULT_APP_NAME);
    } catch (err) {
      console.error('CF Access revoke failed:', err);
      revokeResult = { error: err.message };
    }
    
    // Suspend user (soft delete)
    await env.DB.prepare(`
      UPDATE iam_user 
      SET status = 'suspended', cf_policy_id = NULL, updated_at = datetime('now') 
      WHERE id = ?
    `).bind(userId).run();
    
    await logAudit(env, {
      action: 'user:delete',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ user_id: userId, email: user.email, revoke: revokeResult })
    });
    
    return success({ message: 'User suspended and access revoked' });
  } catch (err) {
    return error(`Failed to delete user: ${err.message}`, 500);
  }
}

/**
 * Grant access to specific app
 * POST /iam/users/:userId/grant-access
 */
export async function grantAccess(request, env, ctx) {
  try {
    const { userId } = ctx.params;
    const body = await request.json();
    const { app_name } = body;
    
    if (!app_name) {
      return error('app_name is required', 400, 'MISSING_FIELD');
    }
    
    const user = await env.DB.prepare(
      'SELECT email FROM iam_user WHERE id = ?'
    ).bind(userId).first();
    
    if (!user) {
      return error('User not found', 404, 'NOT_FOUND');
    }
    
    const cf = getCfAccessController(env);
    const result = await cf.grantUserAccess(user.email, app_name);
    
    await logAudit(env, {
      action: 'user:grant_access',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ user_id: userId, app_name, result })
    });
    
    return success({ 
      message: result.alreadyExists ? 'User already has access' : 'Access granted',
      result 
    });
  } catch (err) {
    return error(`Failed to grant access: ${err.message}`, 500);
  }
}

/**
 * Revoke access from specific app
 * POST /iam/users/:userId/revoke-access
 */
export async function revokeAccess(request, env, ctx) {
  try {
    const { userId } = ctx.params;
    const body = await request.json();
    const { app_name } = body;
    
    if (!app_name) {
      return error('app_name is required', 400, 'MISSING_FIELD');
    }
    
    const user = await env.DB.prepare(
      'SELECT email FROM iam_user WHERE id = ?'
    ).bind(userId).first();
    
    if (!user) {
      return error('User not found', 404, 'NOT_FOUND');
    }
    
    const cf = getCfAccessController(env);
    const result = await cf.revokeUserAccess(user.email, app_name);
    
    await logAudit(env, {
      action: 'user:revoke_access',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ user_id: userId, app_name, result })
    });
    
    return success({ 
      message: result.found ? 'Access revoked' : 'User did not have access',
      result 
    });
  } catch (err) {
    return error(`Failed to revoke access: ${err.message}`, 500);
  }
}

/**
 * Get user's roles via groups
 * GET /iam/users/:identifier/roles
 * 
 * GENERIC endpoint - returns raw role data without app-specific interpretation.
 * Applications should interpret roles according to their own business logic.
 * 
 * @param {string} identifier - User ID or email
 * @returns {Array} - List of role objects {id, name, description}
 */
export async function getUserRoles(request, env, ctx) {
  try {
    const { identifier } = ctx.params;
    
    if (!identifier) {
      return error('identifier is required', 400, 'MISSING_FIELD');
    }
    
    // Query user's roles via group memberships
    // GENERIC: No app-specific logic here - returns all roles
    const { results } = await env.DB.prepare(`
      SELECT DISTINCT r.id, r.name, r.description
      FROM iam_role r
      JOIN iam_group_role gr ON r.id = gr.role_id
      JOIN iam_user_group ug ON gr.group_id = ug.group_id
      JOIN iam_user u ON ug.user_id = u.id
      WHERE u.email = ? OR u.id = ?
    `).bind(identifier, identifier).all();
    
    return success({ 
      identifier,
      roles: results || []
      // NO default role, NO interpretation - raw data only
    });
  } catch (err) {
    return error(`Failed to get user roles: ${err.message}`, 500);
  }
}

