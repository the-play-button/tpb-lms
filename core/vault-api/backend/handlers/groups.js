/**
 * IAM Group Management Handlers
 * 
 * Group membership syncs to infrastructure via infraProvider when:
 * - Group name matches an application's namespace pattern ({namespace}_*)
 * - Application has audiences configured
 */

import { error, success } from '../utils/response.js';
import { logAudit } from './audit.js';
import { getInfraProvider } from '../services/infraProvider.js';

const DEFAULT_ORG_ID = 'org_tpb';

/**
 * Extract namespace from group ID (grp_tpblms_admins -> tpblms)
 */
function extractNamespace(groupId) {
  // Group IDs are: grp_<namespace>_<name> or grp_<random>
  const match = groupId.match(/^grp_([a-z]+)_/);
  return match ? match[1] : null;
}

/**
 * Get application by namespace
 */
async function getApplicationByNamespace(db, namespace) {
  return db.prepare(`
    SELECT * FROM iam_application WHERE namespace = ? AND status = 'active'
  `).bind(namespace).first();
}

/**
 * Sync a user's membership to infrastructure for all audiences of a namespace
 */
async function syncMemberToInfra(env, namespace, email, action) {
  const app = await getApplicationByNamespace(env.DB, namespace);
  if (!app || !app.audiences) return { synced: false, reason: 'no_audiences' };
  
  const audiences = JSON.parse(app.audiences);
  if (audiences.length === 0) return { synced: false, reason: 'empty_audiences' };
  
  const infraProvider = getInfraProvider(env);
  const results = [];
  
  for (const audience of audiences) {
    try {
      if (action === 'add') {
        await infraProvider.addMember(audience, email);
      } else if (action === 'remove') {
        await infraProvider.removeMember(audience, email);
      }
      results.push({ audience, status: 'ok' });
    } catch (err) {
      console.error(`Failed to ${action} member to ${audience}:`, err);
      results.push({ audience, status: 'error', error: err.message });
    }
  }
  
  return { synced: true, results };
}

/**
 * Check if user is still in any other group of the same namespace
 */
async function userInOtherNamespaceGroups(db, userId, namespace, excludeGroupId) {
  const { results } = await db.prepare(`
    SELECT g.id FROM iam_group g
    JOIN iam_user_group ug ON g.id = ug.group_id
    WHERE ug.user_id = ? AND g.id LIKE ? AND g.id != ?
  `).bind(userId, `grp_${namespace}_%`, excludeGroupId).all();
  
  return results.length > 0;
}

/**
 * List groups
 * GET /iam/groups
 */
export async function listGroups(request, env, ctx) {
  try {
    const orgId = DEFAULT_ORG_ID;
    
    const { results } = await env.DB.prepare(`
      SELECT g.*,
             (SELECT COUNT(*) FROM iam_user_group WHERE group_id = g.id) as member_count,
             (SELECT GROUP_CONCAT(r.name) FROM iam_group_role gr 
              JOIN iam_role r ON gr.role_id = r.id WHERE gr.group_id = g.id) as roles
      FROM iam_group g
      WHERE g.organization_id = ? AND g.is_active = 1
      ORDER BY g.name
    `).bind(orgId).all();
    
    const groups = results.map(g => ({
      ...g,
      roles: g.roles ? g.roles.split(',') : []
    }));
    
    return success({ groups });
  } catch (err) {
    return error(`Failed to list groups: ${err.message}`, 500);
  }
}

/**
 * Create group
 * POST /iam/groups
 */
export async function createGroup(request, env, ctx) {
  try {
    const body = await request.json();
    const { name, type = 'team', description, parent_id } = body;
    
    if (!name) {
      return error('name is required', 400, 'MISSING_FIELD');
    }
    
    const orgId = DEFAULT_ORG_ID;
    const groupId = `grp_${crypto.randomUUID().slice(0, 8)}`;
    
    await env.DB.prepare(`
      INSERT INTO iam_group (id, organization_id, name, type, description, parent_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(groupId, orgId, name, type, description || null, parent_id || null).run();
    
    await logAudit(env, {
      action: 'group:create',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ group_id: groupId, name })
    });
    
    return success({ group: { id: groupId, name, type } }, 201);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return error(`Group '${body?.name}' already exists`, 409, 'EXISTS');
    }
    return error(`Failed to create group: ${err.message}`, 500);
  }
}

/**
 * Get group with members and roles
 * GET /iam/groups/:groupId
 */
export async function getGroup(request, env, ctx) {
  try {
    const { groupId } = ctx.params;
    
    const group = await env.DB.prepare(`
      SELECT * FROM iam_group WHERE id = ?
    `).bind(groupId).first();
    
    if (!group) {
      return error('Group not found', 404, 'NOT_FOUND');
    }
    
    // Get members
    const { results: members } = await env.DB.prepare(`
      SELECT u.id, u.email, u.display_name, u.status, ug.joined_at
      FROM iam_user u
      JOIN iam_user_group ug ON u.id = ug.user_id
      WHERE ug.group_id = ?
      ORDER BY u.display_name
    `).bind(groupId).all();
    
    // Get roles
    const { results: roles } = await env.DB.prepare(`
      SELECT r.id, r.name, r.description, r.is_system, gr.granted_at
      FROM iam_role r
      JOIN iam_group_role gr ON r.id = gr.role_id
      WHERE gr.group_id = ?
    `).bind(groupId).all();
    
    group.members = members;
    group.roles = roles;
    
    return success({ group });
  } catch (err) {
    return error(`Failed to get group: ${err.message}`, 500);
  }
}

/**
 * Update group
 * PATCH /iam/groups/:groupId
 */
export async function updateGroup(request, env, ctx) {
  try {
    const { groupId } = ctx.params;
    const body = await request.json();
    
    const updates = [];
    const values = [];
    
    for (const field of ['name', 'description', 'type', 'parent_id', 'is_active']) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }
    
    if (updates.length === 0) {
      return error('No fields to update', 400, 'NO_UPDATES');
    }
    
    values.push(groupId);
    
    await env.DB.prepare(`
      UPDATE iam_group SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();
    
    return success({ message: 'Group updated' });
  } catch (err) {
    return error(`Failed to update group: ${err.message}`, 500);
  }
}

/**
 * Add member to group
 * POST /iam/groups/:groupId/members
 * 
 * Automatically syncs to infrastructure if group belongs to an application namespace
 */
export async function addMember(request, env, ctx) {
  try {
    const { groupId } = ctx.params;
    const body = await request.json();
    const { user_id } = body;
    
    if (!user_id) {
      return error('user_id is required', 400, 'MISSING_FIELD');
    }
    
    // Verify group exists
    const group = await env.DB.prepare('SELECT id, name FROM iam_group WHERE id = ?').bind(groupId).first();
    if (!group) {
      return error('Group not found', 404, 'NOT_FOUND');
    }
    
    // Verify user exists and get email
    const user = await env.DB.prepare('SELECT id, email FROM iam_user WHERE id = ?').bind(user_id).first();
    if (!user) {
      return error('User not found', 404, 'USER_NOT_FOUND');
    }
    
    // Add to vault
    await env.DB.prepare(`
      INSERT INTO iam_user_group (user_id, group_id) VALUES (?, ?)
    `).bind(user_id, groupId).run();
    
    // Sync to infrastructure if group belongs to an application namespace
    let infraSync = { synced: false };
    const namespace = extractNamespace(groupId);
    if (namespace && user.email) {
      infraSync = await syncMemberToInfra(env, namespace, user.email, 'add');
    }
    
    await logAudit(env, {
      action: 'group:add_member',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ group_id: groupId, user_id, email: user.email, infraSync })
    });
    
    return success({ 
      message: 'Member added',
      infra_sync: infraSync
    });
  } catch (err) {
    if (err.message.includes('UNIQUE') || err.message.includes('PRIMARY')) {
      return error('User already in group', 409, 'EXISTS');
    }
    return error(`Failed to add member: ${err.message}`, 500);
  }
}

/**
 * Remove member from group
 * DELETE /iam/groups/:groupId/members/:userId
 * 
 * Automatically syncs to infrastructure if:
 * - Group belongs to an application namespace
 * - User is NOT in any other group of the same namespace
 */
export async function removeMember(request, env, ctx) {
  try {
    const { groupId, userId } = ctx.params;
    
    // Get user email before removing
    const user = await env.DB.prepare('SELECT email FROM iam_user WHERE id = ?').bind(userId).first();
    
    const result = await env.DB.prepare(`
      DELETE FROM iam_user_group WHERE group_id = ? AND user_id = ?
    `).bind(groupId, userId).run();
    
    if (result.changes === 0) {
      return error('Member not found in group', 404, 'NOT_FOUND');
    }
    
    // Sync to infrastructure if appropriate
    let infraSync = { synced: false };
    const namespace = extractNamespace(groupId);
    if (namespace && user?.email) {
      // Only remove from infra if user is NOT in any other group of same namespace
      const stillInNamespace = await userInOtherNamespaceGroups(env.DB, userId, namespace, groupId);
      if (!stillInNamespace) {
        infraSync = await syncMemberToInfra(env, namespace, user.email, 'remove');
      } else {
        infraSync = { synced: false, reason: 'still_in_other_groups' };
      }
    }
    
    await logAudit(env, {
      action: 'group:remove_member',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ group_id: groupId, user_id: userId, email: user?.email, infraSync })
    });
    
    return success({ 
      message: 'Member removed',
      infra_sync: infraSync
    });
  } catch (err) {
    return error(`Failed to remove member: ${err.message}`, 500);
  }
}

/**
 * Assign role to group
 * POST /iam/groups/:groupId/roles
 */
export async function assignRole(request, env, ctx) {
  try {
    const { groupId } = ctx.params;
    const body = await request.json();
    const { role_id } = body;
    
    if (!role_id) {
      return error('role_id is required', 400, 'MISSING_FIELD');
    }
    
    // Verify role exists
    const role = await env.DB.prepare('SELECT id, name FROM iam_role WHERE id = ?').bind(role_id).first();
    if (!role) {
      return error('Role not found', 404, 'ROLE_NOT_FOUND');
    }
    
    await env.DB.prepare(`
      INSERT INTO iam_group_role (group_id, role_id) VALUES (?, ?)
    `).bind(groupId, role_id).run();
    
    await logAudit(env, {
      action: 'group:assign_role',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ group_id: groupId, role_id, role_name: role.name })
    });
    
    return success({ message: `Role '${role.name}' assigned` });
  } catch (err) {
    if (err.message.includes('UNIQUE') || err.message.includes('PRIMARY')) {
      return error('Role already assigned to group', 409, 'EXISTS');
    }
    return error(`Failed to assign role: ${err.message}`, 500);
  }
}

/**
 * Remove role from group
 * DELETE /iam/groups/:groupId/roles/:roleId
 */
export async function removeRole(request, env, ctx) {
  try {
    const { groupId, roleId } = ctx.params;
    
    const result = await env.DB.prepare(`
      DELETE FROM iam_group_role WHERE group_id = ? AND role_id = ?
    `).bind(groupId, roleId).run();
    
    if (result.changes === 0) {
      return error('Role not assigned to group', 404, 'NOT_FOUND');
    }
    
    await logAudit(env, {
      action: 'group:remove_role',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ group_id: groupId, role_id: roleId })
    });
    
    return success({ message: 'Role removed' });
  } catch (err) {
    return error(`Failed to remove role: ${err.message}`, 500);
  }
}

