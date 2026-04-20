/**
 * Main Authentication Function
 *
 * Authenticate request using JWT OR API Key
 * Checks in order:
 * 1. Cf-Access-Jwt-Assertion header (JWT from CF Access)
 * 2. Authorization: Bearer header (API Key)
 */

import { jsonResponse } from '../cors.js';
import { verifyAccessJWT } from './verifyAccessJWT.js';
import { verifyAPIKey } from './verifyAPIKey.js';
import { getOrCreateContact } from './getOrCreateContact.js';
import { resolveRole } from './resolveRole.js';

export const authenticateRequest = async (request, env) => {
    const jwtToken = request.headers.get('Cf-Access-Jwt-Assertion');

    if (jwtToken) {
        const jwtResult = await verifyAccessJWT(jwtToken, env);

        if (jwtResult.valid) {
            const contact = await getOrCreateContact(jwtResult.email, env);
            const role = await resolveRole(jwtResult.email, env);

            return {
                user: {
                    email: jwtResult.email,
                    role,
                    payload: jwtResult.payload
                },
                contact,
                learner: contact,
                authMethod: jwtResult.authMethod || 'jwt'
            };
        }

        return {
            error: jsonResponse({
                error: `Authentication failed: ${jwtResult.error}`,
                authMethod: jwtResult.authMethod || 'jwt'
            }, 403, request)
        };
    }

    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const apiKey = authHeader.slice(7); // entropy-naming-convention-ok: single key extracted from header
        const keyResult = await verifyAPIKey(apiKey, env);

        if (keyResult.valid) {
            let contact = null;
            let role = 'student';

            if (keyResult.userId) {
                contact = await env.DB.prepare(`
                    SELECT * FROM crm_contact WHERE id = ?
                `).bind(keyResult.userId).first();

                if (contact?.emails_json) {
                    const emails = JSON.parse(contact.emails_json);
                    if (emails.length > 0) {
                        role = await resolveRole(emails[0].email, env);
                    }
                }
            }

            return {
                user: {
                    keyId: keyResult.keyId,
                    keyName: keyResult.keyName,
                    scopes: keyResult.scopes,
                    role
                },
                contact,
                learner: contact,
                authMethod: 'api_key'
            };
        }

        return {
            error: jsonResponse({
                error: `Authentication failed: ${keyResult.error}`,
                authMethod: 'api_key'
            }, 403, request)
        };
    }

    return {
        error: jsonResponse({
            error: 'Missing authentication. Provide Cf-Access-Jwt-Assertion or Authorization: Bearer header.',
            hint: 'Use JWT for browser access, API Key for programmatic access.'
        }, 401, request)
    };
};
