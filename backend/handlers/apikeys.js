/**
 * API Keys Handler
 * 
 * CRUD operations for API key management.
 * 
 * Endpoints:
 * - POST /api/auth/api-keys - Create new API key for current user
 * - GET /api/auth/api-keys - List user's API keys
 * - DELETE /api/auth/api-keys/:id - Revoke an API key
 * - POST /api/admin/api-keys - Admin: Create API key for any user by email
 */

import { jsonResponse } from '../cors.js';
import { generateAPIKey, getOrCreateContact } from '../auth.js';

/**
 * Create a new API key
 * POST /api/auth/api-keys
 * Body: { name: string, scopes?: string, expiresAt?: string }
 * 
 * Returns the key ONLY ONCE at creation time.
 */
export async function createAPIKeyHandler(request, env, auth) {
    try {
        const body = await request.json();
        
        if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
            return jsonResponse({ error: 'Name is required' }, 400, request);
        }
        
        // Get owner user_id from contact
        const userId = auth.contact?.id || null;
        
        const result = await generateAPIKey(
            body.name.trim(),
            userId,
            env,
            {
                scopes: body.scopes || '*',
                expiresAt: body.expiresAt || null
            }
        );
        
        // IMPORTANT: The key is only shown once!
        return jsonResponse({
            success: true,
            message: 'API key created. Save it now - it will not be shown again!',
            apiKey: {
                id: result.id,
                key: result.key, // ONLY returned at creation
                prefix: result.prefix,
                name: result.name,
                scopes: result.scopes,
                expiresAt: result.expiresAt,
                createdAt: result.createdAt
            }
        }, 201, request);
        
    } catch (error) {
        console.error('Create API key error:', error);
        return jsonResponse({ error: 'Failed to create API key' }, 500, request);
    }
}

/**
 * List API keys for the current user
 * GET /api/auth/api-keys
 * 
 * Returns key prefix only (never the full key).
 */
export async function listAPIKeysHandler(request, env, auth) {
    try {
        const userId = auth.contact?.id;
        
        if (!userId) {
            return jsonResponse({ error: 'User not found' }, 400, request);
        }
        
        const keys = await env.DB.prepare(`
            SELECT id, name, key_prefix, scopes, created_at, last_used_at, expires_at, is_active
            FROM api_key 
            WHERE user_id = ?
            ORDER BY created_at DESC
        `).bind(userId).all();
        
        return jsonResponse({
            apiKeys: keys.results.map(k => ({
                id: k.id,
                name: k.name,
                prefix: k.key_prefix,
                scopes: k.scopes,
                createdAt: k.created_at,
                lastUsedAt: k.last_used_at,
                expiresAt: k.expires_at,
                isActive: k.is_active === 1
            }))
        }, 200, request);
        
    } catch (error) {
        console.error('List API keys error:', error);
        return jsonResponse({ error: 'Failed to list API keys' }, 500, request);
    }
}

/**
 * Revoke an API key
 * DELETE /api/auth/api-keys/:id
 */
export async function revokeAPIKeyHandler(request, env, auth, keyId) {
    try {
        const userId = auth.contact?.id;
        
        if (!userId) {
            return jsonResponse({ error: 'User not found' }, 400, request);
        }
        
        // Check key ownership
        const key = await env.DB.prepare(`
            SELECT id FROM api_key WHERE id = ? AND user_id = ?
        `).bind(keyId, userId).first();
        
        if (!key) {
            return jsonResponse({ error: 'API key not found' }, 404, request);
        }
        
        // Soft delete (set is_active = 0)
        await env.DB.prepare(`
            UPDATE api_key SET is_active = 0 WHERE id = ?
        `).bind(keyId).run();
        
        return jsonResponse({ success: true, message: 'API key revoked' }, 200, request);
        
    } catch (error) {
        console.error('Revoke API key error:', error);
        return jsonResponse({ error: 'Failed to revoke API key' }, 500, request);
    }
}

/**
 * Admin: Create API key for any user by email
 * POST /api/admin/api-keys
 * Body: { name: string, user_email: string, scopes?: string, expiresAt?: string }
 * 
 * Admin-only endpoint to create API keys for other users (for testing, integrations).
 * Returns the key ONLY ONCE at creation time.
 */
export async function adminCreateAPIKeyHandler(request, env, userContext) {
    try {
        // Check admin role
        if (userContext.user?.role !== 'admin') {
            return jsonResponse({ error: 'Forbidden: Admin role required' }, 403, request);
        }
        
        const body = await request.json();
        
        if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
            return jsonResponse({ error: 'Name is required' }, 400, request);
        }
        
        if (!body.user_email || typeof body.user_email !== 'string') {
            return jsonResponse({ error: 'user_email is required' }, 400, request);
        }
        
        // Get or create contact for the target user
        const contact = await getOrCreateContact(body.user_email, env);
        
        const result = await generateAPIKey(
            body.name.trim(),
            contact.id,
            env,
            {
                scopes: body.scopes || '*',
                expiresAt: body.expiresAt || null
            }
        );
        
        // IMPORTANT: The key is only shown once!
        return jsonResponse({
            success: true,
            message: 'API key created for user. Save it now - it will not be shown again!',
            apiKey: {
                id: result.id,
                key: result.key, // ONLY returned at creation
                prefix: result.prefix,
                name: result.name,
                userId: contact.id,
                userEmail: body.user_email,
                scopes: result.scopes,
                expiresAt: result.expiresAt,
                createdAt: result.createdAt
            }
        }, 201, request);
        
    } catch (error) {
        console.error('Admin create API key error:', error);
        return jsonResponse({ error: 'Failed to create API key' }, 500, request);
    }
}

