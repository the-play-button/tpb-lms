# Phase 3 - User Management

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/iam/users` | List users (current org) |
| POST | `/iam/users` | Create user + grant CF Access |
| GET | `/iam/users/:userId` | Get user |
| PATCH | `/iam/users/:userId` | Update user |
| DELETE | `/iam/users/:userId` | Suspend + revoke CF Access |
| POST | `/iam/users/:userId/grant-access` | Grant CF Access to specific app |
| POST | `/iam/users/:userId/revoke-access` | Revoke CF Access from app |

## Handler: backend/handlers/users.js

```javascript
import { success, error } from '../utils/response.js';
import { getCfAccessController } from '../services/cfAccess.js';
import { logAudit } from './audit.js';

const VAULT_APP_NAME = 'tpb-vault-infra';

/**
 * List users in organization
 */
export async function listUsers(request, env, ctx) {
  // Get org from actor (future: from JWT claims)
  const orgId = 'org_tpb'; // TODO: get from context
  
  const { results } = await env.DB.prepare(`
    SELECT u.*, 
           GROUP_CONCAT(g.name) as groups
    FROM iam_user u
    LEFT JOIN iam_user_group ug ON u.id = ug.user_id
    LEFT JOIN iam_group g ON ug.group_id = g.id
    WHERE u.organization_id = ?
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).bind(orgId).all();
  
  return success({ users: results });
}

/**
 * Create user + auto-grant CF Access to vault-api
 */
export async function createUser(request, env, ctx) {
  const body = await request.json();
  const { email, display_name, user_type = 'human', grant_vault_access = true } = body;
  
  if (!email) return error('email required', 400);
  
  const orgId = 'org_tpb';
  const userId = `usr_${crypto.randomUUID().slice(0, 8)}`;
  
  // Check if exists
  const existing = await env.DB.prepare(
    'SELECT id FROM iam_user WHERE email = ? AND organization_id = ?'
  ).bind(email, orgId).first();
  
  if (existing) {
    return error(`User ${email} already exists`, 409);
  }
  
  // Insert user
  await env.DB.prepare(`
    INSERT INTO iam_user (id, organization_id, email, display_name, user_type, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).bind(userId, orgId, email, display_name || email.split('@')[0], user_type).run();
  
  // Grant CF Access to vault-api
  let cfResult = null;
  if (grant_vault_access && user_type === 'human') {
    try {
      const cf = getCfAccessController(env);
      cfResult = await cf.grantUserAccess(email, VAULT_APP_NAME);
      
      // Store policy ID
      if (cfResult.policyId) {
        await env.DB.prepare(
          'UPDATE iam_user SET cf_policy_id = ? WHERE id = ?'
        ).bind(cfResult.policyId, userId).run();
      }
    } catch (err) {
      console.error('CF Access grant failed:', err);
      // User created but CF access failed - log warning
      cfResult = { error: err.message };
    }
  }
  
  await logAudit(env, {
    action: 'user:create',
    actor_id: ctx.actor?.id,
    resource_type: 'user',
    resource_id: userId,
    context_json: JSON.stringify({ email, cf_result: cfResult })
  });
  
  return success({ 
    user: { id: userId, email, status: 'active' },
    cf_access: cfResult
  }, 201);
}

/**
 * Get single user
 */
export async function getUser(request, env, ctx) {
  const { userId } = ctx.params;
  
  const user = await env.DB.prepare(`
    SELECT u.*, 
           json_group_array(json_object('id', g.id, 'name', g.name)) as groups_json
    FROM iam_user u
    LEFT JOIN iam_user_group ug ON u.id = ug.user_id
    LEFT JOIN iam_group g ON ug.group_id = g.id
    WHERE u.id = ?
    GROUP BY u.id
  `).bind(userId).first();
  
  if (!user) return error('User not found', 404);
  
  user.groups = JSON.parse(user.groups_json || '[]').filter(g => g.id);
  delete user.groups_json;
  
  return success({ user });
}

/**
 * Update user
 */
export async function updateUser(request, env, ctx) {
  const { userId } = ctx.params;
  const body = await request.json();
  
  const updates = [];
  const values = [];
  
  for (const field of ['display_name', 'status', 'manager_id']) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }
  
  if (updates.length === 0) return error('No fields to update', 400);
  
  updates.push("updated_at = datetime('now')");
  values.push(userId);
  
  await env.DB.prepare(`
    UPDATE iam_user SET ${updates.join(', ')} WHERE id = ?
  `).bind(...values).run();
  
  return success({ message: 'User updated' });
}

/**
 * Delete (suspend) user + revoke CF Access
 */
export async function deleteUser(request, env, ctx) {
  const { userId } = ctx.params;
  
  const user = await env.DB.prepare(
    'SELECT email, cf_policy_id FROM iam_user WHERE id = ?'
  ).bind(userId).first();
  
  if (!user) return error('User not found', 404);
  
  // Revoke CF Access
  try {
    const cf = getCfAccessController(env);
    await cf.revokeUserAccess(user.email, VAULT_APP_NAME);
  } catch (err) {
    console.error('CF Access revoke failed:', err);
  }
  
  // Suspend user
  await env.DB.prepare(`
    UPDATE iam_user SET status = 'suspended', updated_at = datetime('now') WHERE id = ?
  `).bind(userId).run();
  
  await logAudit(env, {
    action: 'user:delete',
    actor_id: ctx.actor?.id,
    resource_type: 'user',
    resource_id: userId
  });
  
  return success({ message: 'User suspended and access revoked' });
}

/**
 * Grant access to specific app
 */
export async function grantAccess(request, env, ctx) {
  const { userId } = ctx.params;
  const { app_name } = await request.json();
  
  if (!app_name) return error('app_name required', 400);
  
  const user = await env.DB.prepare(
    'SELECT email FROM iam_user WHERE id = ?'
  ).bind(userId).first();
  
  if (!user) return error('User not found', 404);
  
  const cf = getCfAccessController(env);
  const result = await cf.grantUserAccess(user.email, app_name);
  
  await logAudit(env, {
    action: 'user:grant_access',
    actor_id: ctx.actor?.id,
    resource_type: 'user',
    resource_id: userId,
    context_json: JSON.stringify({ app_name, result })
  });
  
  return success({ result });
}
```

## Routes à ajouter (index.js)

```javascript
import { listUsers, createUser, getUser, updateUser, deleteUser, grantAccess } from './handlers/users.js';

// Dans routes[]
{ method: 'GET', pattern: /^\/iam\/users$/, handler: listUsers },
{ method: 'POST', pattern: /^\/iam\/users$/, handler: createUser },
{ method: 'GET', pattern: /^\/iam\/users\/([^\/]+)$/, handler: getUser, params: ['userId'] },
{ method: 'PATCH', pattern: /^\/iam\/users\/([^\/]+)$/, handler: updateUser, params: ['userId'] },
{ method: 'DELETE', pattern: /^\/iam\/users\/([^\/]+)$/, handler: deleteUser, params: ['userId'] },
{ method: 'POST', pattern: /^\/iam\/users\/([^\/]+)\/grant-access$/, handler: grantAccess, params: ['userId'] },
```

## Fichiers à créer/modifier

- Créer: `backend/handlers/users.js`
- Modifier: `backend/index.js` (routes)

