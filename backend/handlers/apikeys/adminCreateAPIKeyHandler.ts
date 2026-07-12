/**
 * Admin: Create API key for any user by email
 * POST /api/admin/api-keys
 */

import { jsonResponse } from '../../cors.js';
import { generateAPIKey, getOrCreateContact } from '../../auth/index.js';
import { log } from '@the-play-button/tpb-sdk-js';
import type { Env } from "../../types/Env.js";
import type { HandlerUserContext } from "../../types/HandlerContext.js";
import { toError } from "../../utils/toError.js";

interface AdminCreateApiKeyBody {
    name?: string;
    user_email?: string;
    scopes?: string;
    expiresAt?: string | null;
}

export const adminCreateAPIKeyHandler = async (request: Request, env: Env, userContext: HandlerUserContext) => {
    try {
        if (userContext.user?.role !== 'admin') {
            return jsonResponse({ error: 'Forbidden: Admin role required' }, 403, request);
        }

        const body = await request.json() as AdminCreateApiKeyBody;

        if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
            return jsonResponse({ error: 'Name is required' }, 400, request);
        }

        if (!body.user_email || typeof body.user_email !== 'string') {
            return jsonResponse({ error: 'user_email is required' }, 400, request);
        }

        const contact = await getOrCreateContact(body.user_email, env);

        const result = await generateAPIKey(
            body.name.trim(),
            (contact.id as string | null) ?? null,
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
        log.error('admin API key create failed', toError(error), { file: 'handlers/apikeys/adminCreateAPIKeyHandler.js' });
        return jsonResponse({ error: 'Failed to create API key' }, 500, request);
    }
};
