// Audit log handlers (sys_audit_log)

import { json, error, success, generateId } from '../utils/response.js';

/**
 * Log an audit event
 * 
 * @param {object} env - Worker env
 * @param {object} data - Audit data
 * @param {string} data.action - Action performed (e.g., 'user:create', 'secret:read')
 * @param {string} [data.actor_id] - Who performed the action
 * @param {string} [data.actor_type] - Type of actor ('user', 'service_token')
 * @param {string} [data.connection_id] - Related connection
 * @param {string} [data.context_json] - JSON string of additional context
 * @param {object} [data.context] - Object context (will be JSON stringified)
 */
export async function logAudit(env, { connection_id, secret_ref_id, action, actor_id, actor_type, context, context_json }) {
  try {
    const id = generateId('audit');
    // Support both context (object) and context_json (string) formats
    const jsonData = context_json || (context ? JSON.stringify(context) : null);
    
    await env.DB.prepare(`
      INSERT INTO sys_audit_log (id, connection_id, secret_ref_id, action, actor_id, actor_type, context_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, connection_id || null, secret_ref_id || null, action, actor_id || null, actor_type || null, jsonData).run();
    
    return true;
  } catch (err) {
    console.error('Failed to log audit:', err);
    return false;
  }
}

/**
 * Get audit log for a connection
 * GET /vault/connections/:id/audit
 */
export async function getAuditLog(request, env, ctx) {
  const { id } = ctx.params;
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const action = url.searchParams.get('action');
  
  try {
    // Check connection exists
    const conn = await env.DB.prepare(
      'SELECT id FROM connection WHERE id = ?'
    ).bind(id).first();
    
    if (!conn) {
      return error(`Connection '${id}' not found`, 404, 'CONNECTION_NOT_FOUND');
    }
    
    // Build query
    let query = `
      SELECT id, connection_id, secret_ref_id, action, actor_id, actor_type, context_json, created_at
      FROM sys_audit_log
      WHERE connection_id = ?
    `;
    const bindings = [id];
    
    if (action) {
      query += ' AND action = ?';
      bindings.push(action);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);
    
    const { results } = await env.DB.prepare(query).bind(...bindings).all();
    
    const logs = results.map(log => ({
      ...log,
      context: log.context_json ? JSON.parse(log.context_json) : null,
    }));
    
    return success({ logs });
  } catch (err) {
    return error(`Failed to get audit log: ${err.message}`, 500);
  }
}
