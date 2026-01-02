# Phase 5 - CASL Authorization

## Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/iam/can` | Check authorization |
| GET | `/iam/me/abilities` | Get user's full ability set |

## Dépendance

```bash
npm install @casl/ability
```

## Handler: backend/handlers/can.js

```javascript
import { success, error } from '../utils/response.js';
import { createMongoAbility, AbilityBuilder } from '@casl/ability';

/**
 * Build CASL abilities from user's groups -> roles -> permissions
 */
async function buildAbilitiesForUser(env, userId) {
  // Get user's permissions via groups -> roles
  const { results: perms } = await env.DB.prepare(`
    SELECT DISTINCT p.action, p.resource
    FROM iam_user u
    JOIN iam_user_group ug ON u.id = ug.user_id
    JOIN iam_group_role gr ON ug.group_id = gr.group_id
    JOIN iam_role_permission rp ON gr.role_id = rp.role_id
    JOIN iam_permission p ON rp.permission_id = p.id
    WHERE u.id = ?
  `).bind(userId).all();
  
  const { can, build } = new AbilityBuilder(createMongoAbility);
  
  for (const perm of perms) {
    if (perm.resource === '*') {
      can(perm.action, 'all');
    } else {
      can(perm.action, perm.resource);
    }
  }
  
  return build();
}

/**
 * Get user ID from email (via JWT or lookup)
 */
async function getUserIdFromActor(env, actor) {
  if (!actor?.id) return null;
  
  // actor.id is email for human users
  const user = await env.DB.prepare(
    'SELECT id FROM iam_user WHERE email = ? AND status = ?'
  ).bind(actor.id, 'active').first();
  
  return user?.id;
}

/**
 * POST /iam/can
 * Check if action is allowed
 */
export async function checkCan(request, env, ctx) {
  const body = await request.json();
  const { action, resource, resource_id, user_id } = body;
  
  if (!action || !resource) {
    return error('action and resource required', 400);
  }
  
  // Use provided user_id or get from actor
  const targetUserId = user_id || await getUserIdFromActor(env, ctx.actor);
  
  if (!targetUserId) {
    return error('User not found in IAM', 403);
  }
  
  const ability = await buildAbilitiesForUser(env, targetUserId);
  const allowed = ability.can(action, resource);
  
  // Get matching rule for explanation
  const relevantRule = ability.relevantRuleFor(action, resource);
  
  return success({
    allowed,
    user_id: targetUserId,
    action,
    resource,
    resource_id,
    reason: relevantRule ? `${relevantRule.action}:${relevantRule.subject}` : 'no matching rule',
    rules_count: ability.rules.length
  });
}

/**
 * GET /iam/me/abilities
 * Get current user's full ability set (for client-side caching)
 */
export async function getMyAbilities(request, env, ctx) {
  const userId = await getUserIdFromActor(env, ctx.actor);
  
  if (!userId) {
    return error('User not found in IAM', 403);
  }
  
  const ability = await buildAbilitiesForUser(env, userId);
  
  // Format for client
  const rules = ability.rules.map(r => ({
    action: r.action,
    subject: r.subject,
    conditions: r.conditions
  }));
  
  return success({
    user_id: userId,
    rules,
    // Convenience: pre-computed common checks
    can: {
      'manage:all': ability.can('manage', 'all'),
      'read:secret': ability.can('read', 'secret'),
      'write:secret': ability.can('write', 'secret'),
      'manage:user': ability.can('manage', 'user'),
      'create:service_token': ability.can('create', 'service_token')
    }
  });
}

/**
 * Middleware helper for route protection
 */
export function requirePermission(action, resource) {
  return async (request, env, ctx, next) => {
    const userId = await getUserIdFromActor(env, ctx.actor);
    if (!userId) {
      return error('User not found in IAM', 403);
    }
    
    const ability = await buildAbilitiesForUser(env, userId);
    if (!ability.can(action, resource)) {
      return error(`Permission denied: ${action}:${resource}`, 403, 'FORBIDDEN');
    }
    
    ctx.ability = ability;
    ctx.iamUserId = userId;
    return next();
  };
}
```

## Routes

```javascript
import { checkCan, getMyAbilities } from './handlers/can.js';

{ method: 'POST', pattern: /^\/iam\/can$/, handler: checkCan },
{ method: 'GET', pattern: /^\/iam\/me\/abilities$/, handler: getMyAbilities },
```

## Usage côté client (apps)

```javascript
// Check single permission
const resp = await fetch('https://vault-api.../iam/can', {
  method: 'POST',
  headers: { 'CF-Access-Client-Id': '...', 'CF-Access-Client-Secret': '...' },
  body: JSON.stringify({
    action: 'read',
    resource: 'course',
    resource_id: 'course_123'
  })
});
const { allowed } = await resp.json();

// Get all abilities (cache client-side)
const abilities = await fetch('https://vault-api.../iam/me/abilities', {
  headers: { 'CF-Access-Client-Id': '...', 'CF-Access-Client-Secret': '...' }
}).then(r => r.json());

// Use with @casl/ability on client
import { createMongoAbility } from '@casl/ability';
const ability = createMongoAbility(abilities.rules);
if (ability.can('read', 'Course')) { /* ... */ }
```

