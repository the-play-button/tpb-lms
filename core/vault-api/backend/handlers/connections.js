/**
 * Connection handlers (Unified.to aligned)
 * 
 * Architecture:
 * - D1 connection: metadata
 * - D1 connection_auth: auth metadata (1:1)
 * - D1 sys_secret_ref: registry of secrets (name -> cf_key)
 * - Cloudflare Secrets: actual values (stored via CF API)
 */

import { json, error, success, generateId } from '../utils/response.js';
import { logAudit } from './audit.js';
import { getUserIdFromEmail, isSuperAdmin } from './can.js';
import { getCfSecretsController } from '../services/cfSecrets.js';

/**
 * Check if actor can access a connection
 * Implements access control for user_settings connections
 * 
 * Access rules:
 * - Infra/integrations: normal IAM permissions (read:secret)
 * - User settings:
 *   - Owner: always
 *   - SuperAdmin: always
 *   - Service tokens (TPB app): always (automation app, full access)
 *   - Other users: DENIED
 */
async function canAccessConnection(env, actor, connection) {
  // Infra/integrations: controlled by normal IAM permissions (read:secret)
  if (connection.integration_type !== 'user_settings') {
    return true;
  }
  
  // User settings: access rules
  
  // 1. Service tokens (TPB automation app) have full access
  if (actor.type === 'service_token') {
    return true;
  }
  
  // 2. SuperAdmin can access all user secrets
  if (await isSuperAdmin(env, actor.id)) {
    return true;
  }
  
  // 3. Owner can always access their own secrets
  const actorUserId = await getUserIdFromEmail(env, actor.id);
  if (connection.owner_user_id === actorUserId) {
    return true;
  }
  
  // 4. All other users: DENIED
  return false;
}

/**
 * Build auth object with secrets from registry
 * 1. Read sys_secret_ref to get cf_key mappings
 * 2. Read values from env[cf_key]
 * 
 * Returns secrets with full metadata:
 *   { name: { value, type, description } }
 */
async function buildAuthWithSecrets(env, connectionId, authRow) {
  // Get secret references from D1
  const { results: refs } = await env.DB.prepare(`
    SELECT name, cf_key, type, description
    FROM sys_secret_ref
    WHERE connection_id = ?
  `).bind(connectionId).all();
  
  // Build secrets object with full metadata
  const secrets = {};
  for (const ref of refs) {
    const value = env[ref.cf_key];
    if (value) {
      secrets[ref.name] = {
        value,
        type: ref.type || 'api_key',
        description: ref.description || null,
      };
    }
  }
  
  return {
    name: authRow?.name || null,
    api_url: authRow?.api_url || null,
    app_id: authRow?.app_id || null,
    meta: authRow?.meta_json ? JSON.parse(authRow.meta_json) : null,
    secrets,
  };
}

/**
 * List all connections (no secret values)
 * GET /vault/connections
 */
export async function listConnections(request, env, ctx) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT c.id, c.integration_type, c.integration_name, c.categories_json, 
             c.environment, c.is_paused, c.created_at, c.updated_at, c.owner_user_id,
             (SELECT COUNT(*) FROM sys_secret_ref WHERE connection_id = c.id) as secret_count
      FROM connection c
      WHERE c.is_paused = 0
      ORDER BY c.integration_type
    `).all();
    
    // Filter connections based on access control
    const accessibleConnections = [];
    for (const c of results) {
      if (await canAccessConnection(env, ctx.actor, c)) {
        accessibleConnections.push({
          id: c.id,
          integration_type: c.integration_type,
          integration_name: c.integration_name,
          categories: c.categories_json ? JSON.parse(c.categories_json) : [],
          environment: c.environment,
          secret_count: c.secret_count,
          created_at: c.created_at,
          updated_at: c.updated_at,
        });
      }
    }
    
    return success({ connections: accessibleConnections });
  } catch (err) {
    return error(`Failed to list connections: ${err.message}`, 500);
  }
}

/**
 * Get connection with auth and secrets
 * GET /vault/connections/:id
 */
export async function getConnection(request, env, ctx) {
  const { id } = ctx.params;
  
  try {
    // Get connection
    const conn = await env.DB.prepare(`
      SELECT * FROM connection WHERE id = ?
    `).bind(id).first();
    
    if (!conn) {
      return error(`Connection '${id}' not found`, 404, 'NOT_FOUND');
    }
    
    // Check access control
    if (!await canAccessConnection(env, ctx.actor, conn)) {
      return error('Access denied to this connection', 403, 'FORBIDDEN');
    }
    
    // Get auth metadata
    const auth = await env.DB.prepare(`
      SELECT * FROM connection_auth WHERE connection_id = ?
    `).bind(id).first();
    
    // Build response
    const connection = {
      id: conn.id,
      workspace_id: conn.workspace_id,
      integration_type: conn.integration_type,
      integration_name: conn.integration_name,
      categories: conn.categories_json ? JSON.parse(conn.categories_json) : [],
      permissions: conn.permissions_json ? JSON.parse(conn.permissions_json) : [],
      environment: conn.environment,
      is_paused: !!conn.is_paused,
      created_at: conn.created_at,
      updated_at: conn.updated_at,
      auth: await buildAuthWithSecrets(env, id, auth),
    };
    
    // Log access
    await logAudit(env, {
      connection_id: id,
      action: 'READ',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
    });
    
    return success({ connection });
  } catch (err) {
    return error(`Failed to get connection: ${err.message}`, 500);
  }
}

/**
 * Create connection (admin only)
 * POST /vault/connections
 */
export async function createConnection(request, env, ctx) {
  try {
    const body = await request.json();
    const { 
      id,
      integration_type, 
      integration_name,
      categories = [],
      environment = 'production',
    } = body;
    
    if (!integration_type) {
      return error('integration_type is required', 400, 'MISSING_FIELD');
    }
    
    const connId = id || `conn_${integration_type}`;
    
    // Check if exists
    const existing = await env.DB.prepare(
      'SELECT id FROM connection WHERE id = ?'
    ).bind(connId).first();
    
    if (existing) {
      return error(`Connection '${connId}' already exists`, 409, 'EXISTS');
    }
    
    // Create connection
    await env.DB.prepare(`
      INSERT INTO connection (id, integration_type, integration_name, categories_json, environment)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      connId,
      integration_type,
      integration_name || integration_type,
      JSON.stringify(categories),
      environment
    ).run();
    
    // Create auth entry
    await env.DB.prepare(`
      INSERT INTO connection_auth (id, connection_id, name)
      VALUES (?, ?, ?)
    `).bind(`auth_${integration_type}`, connId, `${integration_name || integration_type} Secrets`).run();
    
    await logAudit(env, {
      connection_id: connId,
      action: 'CREATE',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
    });
    
    return success({ 
      connection: { 
        id: connId, 
        integration_type,
        message: 'Connection created. Add secrets with POST /vault/connections/:id/secrets'
      }
    }, 201);
  } catch (err) {
    return error(`Failed to create connection: ${err.message}`, 500);
  }
}

/**
 * Update connection (admin only)
 * PATCH /vault/connections/:id
 */
export async function updateConnection(request, env, ctx) {
  const { id } = ctx.params;
  
  try {
    const conn = await env.DB.prepare(
      'SELECT id FROM connection WHERE id = ?'
    ).bind(id).first();
    
    if (!conn) {
      return error(`Connection '${id}' not found`, 404, 'NOT_FOUND');
    }
    
    const body = await request.json();
    const updates = [];
    const values = [];
    
    const fields = ['integration_name', 'environment', 'is_paused'];
    for (const field of fields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(field === 'is_paused' ? (body[field] ? 1 : 0) : body[field]);
      }
    }
    
    if (body.categories !== undefined) {
      updates.push('categories_json = ?');
      values.push(JSON.stringify(body.categories));
    }
    
    if (updates.length === 0) {
      return error('No fields to update', 400, 'NO_UPDATES');
    }
    
    updates.push("updated_at = datetime('now')");
    values.push(id);
    
    await env.DB.prepare(`
      UPDATE connection SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();
    
    await logAudit(env, {
      connection_id: id,
      action: 'UPDATE',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
    });
    
    return success({ message: `Connection '${id}' updated` });
  } catch (err) {
    return error(`Failed to update: ${err.message}`, 500);
  }
}

/**
 * Delete connection (admin only, soft delete)
 * DELETE /vault/connections/:id
 */
export async function deleteConnection(request, env, ctx) {
  const { id } = ctx.params;
  
  try {
    const conn = await env.DB.prepare(
      'SELECT id FROM connection WHERE id = ?'
    ).bind(id).first();
    
    if (!conn) {
      return error(`Connection '${id}' not found`, 404, 'NOT_FOUND');
    }
    
    await env.DB.prepare(`
      UPDATE connection SET is_paused = 1, updated_at = datetime('now') WHERE id = ?
    `).bind(id).run();
    
    await logAudit(env, {
      connection_id: id,
      action: 'DELETE',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
    });
    
    return success({ message: `Connection '${id}' deleted` });
  } catch (err) {
    return error(`Failed to delete: ${err.message}`, 500);
  }
}

/**
 * List secret refs for a connection (no values)
 * GET /vault/connections/:id/secrets
 */
export async function listSecretRefs(request, env, ctx) {
  const { id } = ctx.params;
  
  try {
    const conn = await env.DB.prepare(
      'SELECT * FROM connection WHERE id = ?'
    ).bind(id).first();
    
    if (!conn) {
      return error(`Connection '${id}' not found`, 404, 'NOT_FOUND');
    }
    
    // Check access control
    if (!await canAccessConnection(env, ctx.actor, conn)) {
      return error('Access denied to this connection', 403, 'FORBIDDEN');
    }
    
    const { results } = await env.DB.prepare(`
      SELECT id, name, cf_key, type, description, created_at
      FROM sys_secret_ref
      WHERE connection_id = ?
      ORDER BY name
    `).bind(id).all();
    
    // Add has_value flag by checking env
    const secrets = results.map(s => ({
      ...s,
      has_value: !!env[s.cf_key],
    }));
    
    return success({ secrets });
  } catch (err) {
    return error(`Failed to list secrets: ${err.message}`, 500);
  }
}

/**
 * Add secret ref with optional value (admin only)
 * POST /vault/connections/:id/secrets
 * 
 * Body: { name, value?, type?, description? }
 * 
 * If value is provided, stores it via Cloudflare API.
 * Otherwise creates ref only (for backwards compatibility).
 */
export async function addSecretRef(request, env, ctx) {
  const { id } = ctx.params;
  
  try {
    const conn = await env.DB.prepare(
      'SELECT id FROM connection WHERE id = ?'
    ).bind(id).first();
    
    if (!conn) {
      return error(`Connection '${id}' not found`, 404, 'NOT_FOUND');
    }
    
    const body = await request.json();
    const { name, value, type = 'api_key', description } = body;
    
    if (!name) {
      return error('name is required', 400, 'MISSING_FIELD');
    }
    
    // Generate cf_key based on convention
    const cf_key = `CONN_${id.replace('conn_', '')}_${name}`;
    const refId = generateId('ref');
    
    // Insert ref in D1
    await env.DB.prepare(`
      INSERT INTO sys_secret_ref (id, connection_id, name, cf_key, type, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(refId, id, name, cf_key, type, description || null).run();
    
    // If value provided, store via CF API
    let valueStored = false;
    if (value) {
      try {
        const cfSecrets = getCfSecretsController(env);
        await cfSecrets.setSecret(cf_key, value);
        valueStored = true;
      } catch (cfErr) {
        console.error('Failed to store secret value:', cfErr);
        // Don't fail the whole operation - ref is created, value can be set later
      }
    }
    
    await logAudit(env, {
      connection_id: id,
      secret_ref_id: refId,
      action: 'CREATE',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ value_stored: valueStored })
    });
    
    const response = { 
      secret: { 
        id: refId, 
        name, 
        cf_key,
        value_stored: valueStored
      }
    };
    
    if (!valueStored && !value) {
      response.secret.message = `Secret ref created. Set value with PUT /vault/connections/${id}/secrets/${name}`;
    }
    
    return success(response, 201);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return error(`Secret '${body?.name}' already exists`, 409, 'EXISTS');
    }
    return error(`Failed to add secret: ${err.message}`, 500);
  }
}

/**
 * Update secret value (admin only)
 * PUT /vault/connections/:id/secrets/:name
 * 
 * Body: { value }
 * 
 * Updates the secret value via Cloudflare API.
 */
export async function updateSecret(request, env, ctx) {
  const { id, name } = ctx.params;
  
  try {
    // Verify secret ref exists
    const ref = await env.DB.prepare(`
      SELECT id, cf_key FROM sys_secret_ref 
      WHERE connection_id = ? AND name = ?
    `).bind(id, name).first();
    
    if (!ref) {
      return error(`Secret '${name}' not found`, 404, 'NOT_FOUND');
    }
    
    const body = await request.json();
    const { value } = body;
    
    if (!value) {
      return error('value is required', 400, 'MISSING_FIELD');
    }
    
    // Store value via CF API
    const cfSecrets = getCfSecretsController(env);
    await cfSecrets.setSecret(ref.cf_key, value);
    
    // Update timestamp
    await env.DB.prepare(`
      UPDATE sys_secret_ref SET updated_at = datetime('now') WHERE id = ?
    `).bind(ref.id).run();
    
    await logAudit(env, {
      connection_id: id,
      secret_ref_id: ref.id,
      action: 'UPDATE',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
    });
    
    return success({ 
      message: `Secret '${name}' updated successfully`,
      cf_key: ref.cf_key
    });
  } catch (err) {
    return error(`Failed to update secret: ${err.message}`, 500);
  }
}

/**
 * Delete secret ref and value (admin only)
 * DELETE /vault/connections/:id/secrets/:name
 * 
 * Removes both the D1 registry entry AND the Cloudflare secret.
 */
export async function deleteSecretRef(request, env, ctx) {
  const { id, name } = ctx.params;
  
  try {
    const ref = await env.DB.prepare(`
      SELECT id, cf_key FROM sys_secret_ref 
      WHERE connection_id = ? AND name = ?
    `).bind(id, name).first();
    
    if (!ref) {
      return error(`Secret '${name}' not found`, 404, 'NOT_FOUND');
    }
    
    // Delete from D1
    await env.DB.prepare(`
      DELETE FROM sys_secret_ref WHERE id = ?
    `).bind(ref.id).run();
    
    // Also delete from CF (best effort)
    let cfDeleted = false;
    try {
      const cfSecrets = getCfSecretsController(env);
      await cfSecrets.deleteSecret(ref.cf_key);
      cfDeleted = true;
    } catch (cfErr) {
      console.warn('Failed to delete CF secret (may not exist):', cfErr.message);
    }
    
    await logAudit(env, {
      connection_id: id,
      secret_ref_id: ref.id,
      action: 'DELETE',
      actor_id: ctx.actor?.id,
      actor_type: ctx.actor?.type,
      context_json: JSON.stringify({ cf_deleted: cfDeleted })
    });
    
    return success({ 
      message: `Secret '${name}' deleted`,
      cf_key: ref.cf_key,
      cf_deleted: cfDeleted
    });
  } catch (err) {
    return error(`Failed to delete: ${err.message}`, 500);
  }
}
