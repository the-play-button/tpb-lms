/**
 * Create a new API key
 * POST /api/auth/api-keys
 */

import { jsonResponse } from '../../cors.js';
import { generateAPIKey, getOrCreateContact } from '../../auth/index.js';
import { log } from '@the-play-button/tpb-sdk-js';
import type { Env } from "../../types/Env.js";
import type { HandlerUserContext } from "../../types/HandlerContext.js";
import { toError } from "../../utils/toError.js";

interface CreateApiKeyBody {
    name?: string;
    scopes?: string;
    expiresAt?: string | null;
}

export const createAPIKeyHandler = async (request: Request, env: Env, auth: HandlerUserContext) => {
    try {
        const body = await request.json() as CreateApiKeyBody;

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
        log.error('API key create failed', toError(error), { file: 'handlers/apikeys/createAPIKeyHandler.js' });
        return jsonResponse({ error: 'Failed to create API key' }, 500, request);
    }
};
