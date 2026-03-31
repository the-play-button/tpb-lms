/**
 * Main Authentication Function
 *
 * Authenticate request using JWT OR API Key
 * Checks in order:
 * 1. Cf-Access-Jwt-Assertion header (JWT from CF Access or Logto)
 * 2. Authorization: Bearer header (API Key or Logto OIDC token)
 */

import { jsonResponse } from '../cors.js';
import { getAuthConfig } from '../config/auth.js';
import { base64urlDecode } from './_shared.js';
import { verifyAccessJWT } from './verifyAccessJWT.js';
import { verifyOidcJWT } from './verifyOidcJWT.js';
import { verifyAPIKey } from './verifyAPIKey.js';
import { getOrCreateContact } from './getOrCreateContact.js';
import { resolveRole } from './resolveRole.js';

export const authenticateRequest = async (request, env) => {
    const authConfig = getAuthConfig(env);

    let jwtToken = request.headers.get('Cf-Access-Jwt-Assertion');
    let jwtSource = 'cf-access';

    const authHeader = request.headers.get('Authorization');
    if (!jwtToken && authConfig.useLogto && authHeader?.startsWith('Bearer ')) {
        const bearerToken = authHeader.slice(7); // entropy-naming-convention-ok: single token extracted from header
        if (!bearerToken.startsWith('tpb_') && bearerToken.includes('.')) {
            jwtToken = bearerToken;
            jwtSource = 'bearer-oidc';
        }
    }

    if (jwtToken) {
        let jwtResult;
        try {
            const peekPayload = JSON.parse(new TextDecoder().decode(base64urlDecode(jwtToken.split('.')[1])));
            const isLogtoToken = peekPayload.iss && !peekPayload.iss.includes('cloudflareaccess.com');

            if (authConfig.useLogto && isLogtoToken) {
                jwtResult = await verifyOidcJWT(jwtToken, env);
            } else {
                jwtResult = await verifyAccessJWT(jwtToken, env);
            }
        } catch {
            jwtResult = await verifyAccessJWT(jwtToken, env);
        }

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
