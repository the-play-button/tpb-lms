// entropy-positional-args-excess-ok: adminCreateAPIKeyHandler follows DDD pipeline convention (request, ctx, param) positional args
// entropy-handler-service-pattern-ok: adminCreateAPIKeyHandler handler delegates to backend, minimal orchestration logic
// entropy-duplicate-code-handlers-ok: error handling pattern is intentionally similar across API key handlers
/**
 * Admin: Create API key for any user by email
 * POST /api/admin/api-keys
 */

import { jsonResponse } from '../../cors.js';
import { generateAPIKey, getOrCreateContact } from '../../auth/index.js';
import { log } from '@the-play-button/tpb-sdk-js';

export const adminCreateAPIKeyHandler = async (request, env, userContext) => {
    try {
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

        return jsonResponse({
            success: true,
            message: 'API key created for user. Save it now - it will not be shown again!',
            apiKey: {
                id: result.id,
                key: result.key,
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
        log.error('admin API key create failed', error, { file: 'handlers/apikeys/adminCreateAPIKeyHandler.js' });
        return jsonResponse({ error: 'Failed to create API key' }, 500, request);
    }
};
