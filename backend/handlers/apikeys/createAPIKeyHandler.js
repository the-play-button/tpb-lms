/**
 * Create a new API key
 * POST /api/auth/api-keys
 */

import { jsonResponse } from '../../cors.js';
import { generateAPIKey, getOrCreateContact } from '../../auth/index.js';

export async function createAPIKeyHandler(request, env, auth) {
    try {
        const body = await request.json();

        if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
            return jsonResponse({ error: 'Name is required' }, 400, request);
        }

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

        return jsonResponse({
            success: true,
            message: 'API key created. Save it now - it will not be shown again!',
            apiKey: {
                id: result.id,
                key: result.key,
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
