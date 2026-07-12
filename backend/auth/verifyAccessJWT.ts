/**
 * Verify Cloudflare Access JWT
 */

import { base64urlDecode, importPublicKey, getJWKS } from './_shared.js';
import { log } from '@the-play-button/tpb-sdk-js';
import type { Env } from "../types/Env.js";
import { toError } from "../utils/toError.js";

interface JwtPayload { exp?: number; email?: string; sub?: string; [key: string]: unknown; }
interface JwtHeader { kid?: string; [key: string]: unknown; }

export const verifyAccessJWT = async (token: string | null | undefined, env: Env) => {
    if (!token) {
        return { valid: false, error: 'No token provided' };
    }

    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return { valid: false, error: 'Invalid JWT format' };
        }

        const [headerB64, payloadB64, signatureB64] = parts;
        const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64))) as JwtHeader;
        const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64))) as JwtPayload;

        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return { valid: false, error: 'Token expired' };
        }

        const teamDomain = env.ACCESS_TEAM_DOMAIN || 'theplaybutton';
        const jwks = await getJWKS(teamDomain);
        const key = jwks.keys.find((k) => k.kid === header.kid);

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
        log.error('JWT verification error', toError(error), { file: 'auth/verifyAccessJWT.js' });
        return { valid: false, error: 'JWT verification failed' };
    }
};
