# Phase 4 - Groups & Roles

## Endpoints Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/iam/groups` | List groups |
| POST | `/iam/groups` | Create group |
| GET | `/iam/groups/:groupId` | Get group with members |
| PATCH | `/iam/groups/:groupId` | Update group |
| POST | `/iam/groups/:groupId/members` | Add member |
| DELETE | `/iam/groups/:groupId/members/:userId` | Remove member |
| POST | `/iam/groups/:groupId/roles` | Assign role |
| DELETE | `/iam/groups/:groupId/roles/:roleId` | Remove role |

## Endpoints Roles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/iam/roles` | List roles (system + org) |
| POST | `/iam/roles` | Create custom role |
| GET | `/iam/roles/:roleId` | Get role with permissions |
| POST | `/iam/roles/:roleId/permissions` | Add permission |

## Handler: backend/handlers/groups.js

```javascript
import { success, error } from '../utils/response.js';

export async function listGroups(request, env, ctx) {
  const orgId = 'org_tpb';
  
  const { results } = await env.DB.prepare(`
    SELECT g.*,
           (SELECT COUNT(*) FROM iam_user_group WHERE group_id = g.id) as member_count,
           (SELECT GROUP_CONCAT(r.name) FROM iam_group_role gr 
            JOIN iam_role r ON gr.role_id = r.id WHERE gr.group_id = g.id) as roles
    FROM iam_group g
    WHERE g.organization_id = ? AND g.is_active = 1
    ORDER BY g.name
  `).bind(orgId).all();
  
  return success({ groups: results });
}

export async function createGroup(request, env, ctx) {
  const body = await request.json();
  const { name, type = 'team', description, parent_id } = body;
  
  if (!name) return error('name required', 400);
  
  const orgId = 'org_tpb';
  const groupId = `grp_${crypto.randomUUID().slice(0, 8)}`;
  
  await env.DB.prepare(`
    INSERT INTO iam_group (id, organization_id, name, type, description, parent_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(groupId, orgId, name, type, description, parent_id).run();
  
  return success({ group: { id: groupId, name } }, 201);
}

export async function getGroup(request, env, ctx) {
  const { groupId } = ctx.params;
  
  const group = await env.DB.prepare(`
    SELECT g.*,
           json_group_array(json_object(
             'id', u.id, 'email', u.email, 'display_name', u.display_name
           )) as members_json,
           (SELECT json_group_array(json_object('id', r.id, 'name', r.name))
            FROM iam_group_role gr JOIN iam_role r ON gr.role_id = r.id
            WHERE gr.group_id = g.id) as roles_json
    FROM iam_group g
    LEFT JOIN iam_user_group ug ON g.id = ug.group_id
    LEFT JOIN iam_user u ON ug.user_id = u.id
    WHERE g.id = ?
    GROUP BY g.id
  `).bind(groupId).first();
  
  if (!group) return error('Group not found', 404);
  
  group.members = JSON.parse(group.members_json || '[]').filter(m => m.id);
  group.roles = JSON.parse(group.roles_json || '[]');
  delete group.members_json;
  delete group.roles_json;
  
  return success({ group });
}

export async function addMember(request, env, ctx) {
  const { groupId } = ctx.params;
  const { user_id } = await request.json();
  
  if (!user_id) return error('user_id required', 400);
  
  try {
    await env.DB.prepare(`
      INSERT INTO iam_user_group (user_id, group_id) VALUES (?, ?)
    `).bind(user_id, groupId).run();
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return error('User already in group', 409);
    }
    throw err;
  }
  
  return success({ message: 'Member added' });
}

export async function removeMember(request, env, ctx) {
  const { groupId, userId } = ctx.params;
  
  await env.DB.prepare(`
    DELETE FROM iam_user_group WHERE group_id = ? AND user_id = ?
  `).bind(groupId, userId).run();
  
  return success({ message: 'Member removed' });
}

export async function assignRole(request, env, ctx) {
  const { groupId } = ctx.params;
  const { role_id } = await request.json();
  
  if (!role_id) return error('role_id required', 400);
  
  try {
    await env.DB.prepare(`
      INSERT INTO iam_group_role (group_id, role_id) VALUES (?, ?)
    `).bind(groupId, role_id).run();
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return error('Role already assigned', 409);
    }
    throw err;
  }
  
  return success({ message: 'Role assigned' });
}

export async function removeRole(request, env, ctx) {
  const { groupId, roleId } = ctx.params;
  
  await env.DB.prepare(`
    DELETE FROM iam_group_role WHERE group_id = ? AND role_id = ?
  `).bind(groupId, roleId).run();
  
  return success({ message: 'Role removed' });
}
```

## Handler: backend/handlers/roles.js

```javascript
import { success, error } from '../utils/response.js';

export async function listRoles(request, env, ctx) {
  const orgId = 'org_tpb';
  
  const { results } = await env.DB.prepare(`
    SELECT r.*,
           (SELECT GROUP_CONCAT(p.action || ':' || p.resource) 
            FROM iam_role_permission rp JOIN iam_permission p ON rp.permission_id = p.id
            WHERE rp.role_id = r.id) as permissions
    FROM iam_role r
    WHERE r.organization_id IS NULL OR r.organization_id = ?
    ORDER BY r.is_system DESC, r.name
  `).bind(orgId).all();
  
  return success({ roles: results });
}

export async function createRole(request, env, ctx) {
  const body = await request.json();
  const { name, description, permissions = [] } = body;
  
  if (!name) return error('name required', 400);
  
  const orgId = 'org_tpb';
  const roleId = `role_${name.toLowerCase().replace(/\s+/g, '_')}`;
  
  await env.DB.prepare(`
    INSERT INTO iam_role (id, organization_id, name, description, is_system)
    VALUES (?, ?, ?, ?, 0)
  `).bind(roleId, orgId, name, description).run();
  
  // Add permissions
  for (const permId of permissions) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO iam_role_permission (role_id, permission_id) VALUES (?, ?)
    `).bind(roleId, permId).run();
  }
  
  return success({ role: { id: roleId, name } }, 201);
}

export async function getRole(request, env, ctx) {
  const { roleId } = ctx.params;
  
  const role = await env.DB.prepare(`
    SELECT r.*,
           json_group_array(json_object('id', p.id, 'action', p.action, 'resource', p.resource)) as permissions_json
    FROM iam_role r
    LEFT JOIN iam_role_permission rp ON r.id = rp.role_id
    LEFT JOIN iam_permission p ON rp.permission_id = p.id
    WHERE r.id = ?
    GROUP BY r.id
  `).bind(roleId).first();
  
  if (!role) return error('Role not found', 404);
  
  role.permissions = JSON.parse(role.permissions_json || '[]').filter(p => p.id);
  delete role.permissions_json;
  
  return success({ role });
}

export async function listPermissions(request, env, ctx) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM iam_permission ORDER BY resource, action
  `).all();
  
  return success({ permissions: results });
}
```

## Routes à ajouter

```javascript
// Groups
{ method: 'GET', pattern: /^\/iam\/groups$/, handler: listGroups },
{ method: 'POST', pattern: /^\/iam\/groups$/, handler: createGroup },
{ method: 'GET', pattern: /^\/iam\/groups\/([^\/]+)$/, handler: getGroup, params: ['groupId'] },
{ method: 'POST', pattern: /^\/iam\/groups\/([^\/]+)\/members$/, handler: addMember, params: ['groupId'] },
{ method: 'DELETE', pattern: /^\/iam\/groups\/([^\/]+)\/members\/([^\/]+)$/, handler: removeMember, params: ['groupId', 'userId'] },
{ method: 'POST', pattern: /^\/iam\/groups\/([^\/]+)\/roles$/, handler: assignRole, params: ['groupId'] },
{ method: 'DELETE', pattern: /^\/iam\/groups\/([^\/]+)\/roles\/([^\/]+)$/, handler: removeRole, params: ['groupId', 'roleId'] },

// Roles
{ method: 'GET', pattern: /^\/iam\/roles$/, handler: listRoles },
{ method: 'POST', pattern: /^\/iam\/roles$/, handler: createRole },
{ method: 'GET', pattern: /^\/iam\/roles\/([^\/]+)$/, handler: getRole, params: ['roleId'] },
{ method: 'GET', pattern: /^\/iam\/permissions$/, handler: listPermissions },
```

