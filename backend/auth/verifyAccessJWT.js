/**
 * Verify Cloudflare Access JWT
 */

import { base64urlDecode, importPublicKey, getJWKS } from './_shared.js';

export const verifyAccessJWT = async (token, env) => {
    if (!token) {
        return { valid: false, error: 'No token provided' };
    }

    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return { valid: false, error: 'Invalid JWT format' };
        }

        const [headerB64, payloadB64, signatureB64] = parts;
        const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64)));
        const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));

        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return { valid: false, error: 'Token expired' };
        }

        const teamDomain = env.ACCESS_TEAM_DOMAIN || 'theplaybutton';
        const jwks = await getJWKS(teamDomain);
        const key = jwks.keys.find(({ kid } = {}) => kid === header.kid);

        if (!key) {
            return { valid: false, error: 'Key not found in JWKS' };
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
            return { valid: false, error: 'Invalid signature' };
        }

        return {
            valid: true,
            email: payload.email || payload.sub,
            payload,
            authMethod: 'jwt'
        };

    } catch (error) {
        console.error('JWT verification error:', error);
        return { valid: false, error: error.message };
    }
};
