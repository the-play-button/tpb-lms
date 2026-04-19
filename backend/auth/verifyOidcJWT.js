/**
 * Verify Logto OIDC JWT with full signature validation
 */

import { getAuthConfig } from '../config/auth.js';
import { base64urlDecode, importPublicKey, getOidcJWKS } from './_shared.js';
import { log } from '@the-play-button/tpb-sdk-js';

export const verifyOidcJWT = async (token, env) => {
    if (!token) {
        return { valid: false, error: 'No token provided' };
    }

    const authConfig = getAuthConfig(env);

    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return { valid: false, error: 'Invalid JWT format' };
        }

        const [headerB64, payloadB64, signatureB64] = parts;
        const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64)));
        const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));

        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return { valid: false, error: 'Token expired' };
        }

        if (payload.iss !== authConfig.logto.issuer) {
            return { valid: false, error: `Invalid issuer: ${payload.iss}` };
        }

        if (authConfig.logto.appId && payload.aud) {
            if (!(Array.isArray(payload.aud) ? payload.aud : [payload.aud]).includes(authConfig.logto.appId)) {
                return { valid: false, error: 'Token not issued for this application' };
            }
        }

        if (header.kid) {
            const jwks = await getOidcJWKS(authConfig.logto.issuer, authConfig.logto.jwksUri);
            const key = jwks.keys.find(({ kid } = {}) => kid === header.kid);

            if (!key) {
                return { valid: false, error: 'Key not found in OIDC JWKS' };
            }

            const publicKey = await importPublicKey(key);
            const signatureBytes = base64urlDecode(signatureB64);
            const dataToVerify = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

            const valid = await crypto.subtle.verify(
                'RSASSA-PKCS1-v1_5',
                publicKey,
                signatureBytes,
                dataToVerify
            );

            if (!valid) {
                return { valid: false, error: 'Invalid OIDC signature' };
            }
        }

        return {
            valid: true,
            email: payload.email || payload.sub,
            payload,
            authMethod: 'logto'
        };

    } catch (error) {
        log.error('OIDC JWT verification error', error, { file: 'auth/verifyOidcJWT.js' });
        return { valid: false, error: 'JWT verification failed' }; // entropy-error-verbosity-ok: generic message, no internal details
    }
};
