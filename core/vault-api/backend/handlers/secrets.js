/**
 * Secrets Engine Handlers (HashiCorp Vault-style KV)
 * 
 * Endpoints:
 * - POST   /secret/data/:path  - Create/Update secret with value
 * - GET    /secret/data/:path  - Read secret (value included)
 * - DELETE /secret/data/:path  - Delete secret
 * - GET    /secret/metadata/:path - Metadata only (no value)
 * - GET    /secret/list/:prefix - List secrets by prefix
 * 
 * Access Control for users/* paths:
 * - Service tokens: FULL ACCESS (automation)
 * - SuperAdmin: FULL ACCESS
 * - User with matching ID: ACCESS to their own secrets
 * - Other users: DENIED
 */

import { success, error } from '../utils/response.js';
import { logAudit } from './audit.js';
import { getCfSecretsController } from '../services/cfSecrets.js';
import { getUserIdFromEmail, isSuperAdmin } from './can.js';

/**
 * Convert path to CF secret key
 * e.g. "infra/openai_api_key" -> "SECRET_infra_openai_api_key"
 */
function pathToCfKey(path) {
  return `SECRET_${path.replace(/\//g, '_')}`;
}

/**
 * Check if actor can access a secret path
 * 
 * Access rules:
 * - paths NOT starting with "users/" → normal IAM (allowed if authenticated)
 * - paths "users/{user_id}/*":
 *   - Service tokens: FULL ACCESS (automation apps need to access all user data)
 *   - SuperAdmin: FULL ACCESS
 *   - User with matching ID: ACCESS to their own secrets
 *   - Other users: DENIED
 */
async function canAccessSecretPath(env, actor, path) {
  // paths that don't start with "users/" are accessible with normal IAM permissions
  if (!path.startsWith('users/')) {
    return { allowed: true };
  }
  
  // Service tokens (TPB automation apps) have full access to all user secrets
  if (actor?.type === 'service_token') {
    return { allowed: true };
  }
  
  // SuperAdmin has full access
  if (actor?.id && await isSuperAdmin(env, actor.id)) {
    return { allowed: true };
  }
  
  // Extract user_id from path: users/{user_id}/...
  const pathParts = path.split('/');
  if (pathParts.length < 2) {
    return { allowed: false, reason: 'Invalid user path format' };
  }
  const pathUserId = pathParts[1];
  
  // Get actor's user ID
  const actorUserId = actor?.id ? await getUserIdFromEmail(env, actor.id) : null;
  
  // Owner can access their own secrets
  if (actorUserId && pathUserId === actorUserId) {
    return { allowed: true };
  }
  
  return { allowed: false, reason: 'Access denied to other user secrets' };
}

/**
 * Write secret (create or update)
 * POST /secret/data/:path
 * 
 * Body: { value, description?, type?, tags? }
 */
export async function writeSecret(request, env, ctx) {
  const path = ctx.params.path;
  
  if (!path) {
    return error('Path is required', 400, 'MISSING_PATH');
  }
  
  // Access control for users/* paths
  const access = await canAccessSecretPath(env, ctx.actor, path);
  if (!access.allowed) {
    return error(access.reason || 'Access denied', 403, 'FORBIDDEN');
  }
  
  try {
    const body = await request.json();
    const { value, description, type = 'secret', tags } = body;
    
    if (value === undefined || value === null) {
      return error('value is required', 400, 'MISSING_VALUE');
    }
    
    // Generate cf_key from path
    const cf_key = pathToCfKey(path);
    
    // 1. Store value via Cloudflare API
    const cfSecrets = getCfSecretsController(env);
    await cfSecrets.setSecret(cf_key, String(value));
    
    // 2. Store metadata in D1
    const tags_json = tags ? JSON.stringify(tags) : null;
    const created_by = ctx.actor?.id || null;
    
    await env.DB.prepare(`
      INSERT INTO sys_secret (path, cf_key, type, description, tags_json, created_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(path) DO UPDATE SET
        type = excluded.type,
        description = excluded.description,
        tags_json = excluded.tags_json,
        updated_at = datetime('now')
    `).bind(path, cf_key, type, description || null, tags_json, created_by).run();
    
    // 3. Audit log
    await logAudit(env, {
      action: 'secret:write',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ path, type })
    });
    
    return success({
      path,
      cf_key,
      stored: true,
      message: 'Secret stored successfully'
    }, 201);
    
  } catch (err) {
    console.error('writeSecret error:', err);
    return error(`Failed to write secret: ${err.message}`, 500);
  }
}

/**
 * Read secret with value
 * GET /secret/data/:path
 */
export async function readSecret(request, env, ctx) {
  const path = ctx.params.path;
  
  if (!path) {
    return error('Path is required', 400, 'MISSING_PATH');
  }
  
  // Access control for users/* paths
  const access = await canAccessSecretPath(env, ctx.actor, path);
  if (!access.allowed) {
    return error(access.reason || 'Access denied', 403, 'FORBIDDEN');
  }
  
  try {
    // 1. Get metadata from D1
    const secret = await env.DB.prepare(`
      SELECT path, cf_key, type, description, tags_json, created_by, created_at, updated_at
      FROM sys_secret WHERE path = ?
    `).bind(path).first();
    
    if (!secret) {
      return error(`Secret not found at path: ${path}`, 404, 'NOT_FOUND');
    }
    
    // 2. Get value from CF secrets (via env)
    const value = env[secret.cf_key];
    
    // 3. Audit log
    await logAudit(env, {
      action: 'secret:read',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ path })
    });
    
    return success({
      data: {
        path: secret.path,
        value: value || null,
        metadata: {
          type: secret.type,
          description: secret.description,
          tags: secret.tags_json ? JSON.parse(secret.tags_json) : [],
          created_by: secret.created_by,
          created_at: secret.created_at,
          updated_at: secret.updated_at
        }
      }
    });
    
  } catch (err) {
    console.error('readSecret error:', err);
    return error(`Failed to read secret: ${err.message}`, 500);
  }
}

/**
 * Delete secret
 * DELETE /secret/data/:path
 */
export async function deleteSecret(request, env, ctx) {
  const path = ctx.params.path;
  
  if (!path) {
    return error('Path is required', 400, 'MISSING_PATH');
  }
  
  // Access control for users/* paths
  const access = await canAccessSecretPath(env, ctx.actor, path);
  if (!access.allowed) {
    return error(access.reason || 'Access denied', 403, 'FORBIDDEN');
  }
  
  try {
    // 1. Get metadata from D1
    const secret = await env.DB.prepare(`
      SELECT cf_key FROM sys_secret WHERE path = ?
    `).bind(path).first();
    
    if (!secret) {
      return error(`Secret not found at path: ${path}`, 404, 'NOT_FOUND');
    }
    
    // 2. Delete from CF secrets (best effort)
    let cfDeleted = false;
    try {
      const cfSecrets = getCfSecretsController(env);
      await cfSecrets.deleteSecret(secret.cf_key);
      cfDeleted = true;
    } catch (cfErr) {
      console.warn('Failed to delete CF secret:', cfErr.message);
    }
    
    // 3. Delete from D1
    await env.DB.prepare(`
      DELETE FROM sys_secret WHERE path = ?
    `).bind(path).run();
    
    // 4. Audit log
    await logAudit(env, {
      action: 'secret:delete',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ path, cf_deleted: cfDeleted })
    });
    
    return success({
      path,
      deleted: true,
      cf_deleted: cfDeleted
    });
    
  } catch (err) {
    console.error('deleteSecret error:', err);
    return error(`Failed to delete secret: ${err.message}`, 500);
  }
}

/**
 * Read metadata only (no value)
 * GET /secret/metadata/:path
 */
export async function readMetadata(request, env, ctx) {
  const path = ctx.params.path;
  
  if (!path) {
    return error('Path is required', 400, 'MISSING_PATH');
  }
  
  // Access control for users/* paths
  const access = await canAccessSecretPath(env, ctx.actor, path);
  if (!access.allowed) {
    return error(access.reason || 'Access denied', 403, 'FORBIDDEN');
  }
  
  try {
    const secret = await env.DB.prepare(`
      SELECT path, cf_key, type, description, tags_json, created_by, created_at, updated_at
      FROM sys_secret WHERE path = ?
    `).bind(path).first();
    
    if (!secret) {
      return error(`Secret not found at path: ${path}`, 404, 'NOT_FOUND');
    }
    
    return success({
      metadata: {
        path: secret.path,
        type: secret.type,
        description: secret.description,
        tags: secret.tags_json ? JSON.parse(secret.tags_json) : [],
        created_by: secret.created_by,
        created_at: secret.created_at,
        updated_at: secret.updated_at
      }
    });
    
  } catch (err) {
    return error(`Failed to read metadata: ${err.message}`, 500);
  }
}

/**
 * List secrets by prefix
 * GET /secret/list/:prefix
 * 
 * For users/* prefix, filters to only show accessible secrets:
 * - Service tokens & SuperAdmin: see all
 * - Regular users: only see their own (users/{their_id}/*)
 */
export async function listSecrets(request, env, ctx) {
  const prefix = ctx.params.prefix || '';
  
  try {
    let query = `
      SELECT path, type, description, created_at, updated_at
      FROM sys_secret
      WHERE path LIKE ?
      ORDER BY path
    `;
    let bindValue = `${prefix}%`;
    
    // If listing users/* and not service token or superadmin, restrict to own secrets
    if (prefix.startsWith('users/') || prefix === 'users' || prefix === '') {
      const isServiceToken = ctx.actor?.type === 'service_token';
      const isSuper = ctx.actor?.id ? await isSuperAdmin(env, ctx.actor.id) : false;
      
      if (!isServiceToken && !isSuper) {
        // Get actor's user ID to filter
        const actorUserId = ctx.actor?.id ? await getUserIdFromEmail(env, ctx.actor.id) : null;
        
        if (actorUserId && (prefix === '' || prefix === 'users' || prefix.startsWith('users/'))) {
          // For empty or users prefix, we need to filter
          if (prefix === '' || prefix === 'users') {
            // Show all non-user paths + only own user paths
            query = `
              SELECT path, type, description, created_at, updated_at
              FROM sys_secret
              WHERE (path NOT LIKE 'users/%' OR path LIKE ?)
              ORDER BY path
            `;
            bindValue = `users/${actorUserId}/%`;
          } else if (prefix.startsWith('users/')) {
            // Check if user is trying to list another user's secrets
            const pathParts = prefix.split('/');
            if (pathParts.length >= 2 && pathParts[1] !== actorUserId) {
              // Trying to list another user's secrets - return empty
              return success({ prefix, keys: [], count: 0 });
            }
          }
        }
      }
    }
    
    const { results } = await env.DB.prepare(query).bind(bindValue).all();
    
    return success({
      prefix,
      keys: results.map(s => ({
        path: s.path,
        type: s.type,
        description: s.description
      })),
      count: results.length
    });
    
  } catch (err) {
    return error(`Failed to list secrets: ${err.message}`, 500);
  }
}

