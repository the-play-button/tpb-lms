/**
 * Authentication Handler — thin transport adapter over SessionService.
 */

import { jsonResponse } from '../cors.js';
import { verifyAccessJWT, getOrCreateContact } from '../auth/index.js';
import { extractCallerJwt } from '@the-play-button/tpb-sdk-js';
import { fetchUserData, buildSessionResponse } from '../services/auth/SessionService.js';
import type { Env } from "../types/Env.js";

const validateJWT = async (jwt, env: Env, request: Request) => {
    if (!jwt) {
        return {
            error: jsonResponse({
                error: 'Not authenticated',
                message: 'No Access JWT found. Ensure the API is protected by Cloudflare Access.',
            }, 401, request),
        };
    }
    const result = await verifyAccessJWT(jwt, env);
    if (!result.valid) {
        return {
            error: jsonResponse({
                error: 'Authentication failed',
                message: result.error,
            }, 403, request),
        };
    }
    return { result };
};

/**
 * GET /api/auth/session
 */
export const getSession = async (request: Request, env: Env) => {
    // SDK primitive — centralized JWT extraction (CLAUDE.md § BASTION AUTH).
    const validation = await validateJWT(extractCallerJwt(request), env, request);
    if (validation.error) return validation.error;

    const contact = await getOrCreateContact(validation.result.email, env);
    const userData = await fetchUserData(env.DB, contact.id);
    return jsonResponse(buildSessionResponse(validation.result, contact, userData), 200, request);
};
