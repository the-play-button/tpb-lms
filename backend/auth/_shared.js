/**
 * Shared auth primitives - JWKS caching, JWT parsing, crypto helpers
 */

import { getAuthConfig } from '../config/auth.js';

// Cache for JWKS keys
export let jwksCache = null;
export let jwksCacheTime = 0;
export const JWKS_CACHE_TTL = 3600000; // 1 hour

// JWKS cache for OIDC providers
export let oidcJwksCache = null;
export let oidcJwksCacheTime = 0;

/**
 * Fetch and cache JWKS from Cloudflare Access
 */
export async function getJWKS(teamDomain) {
    const now = Date.now();

    if (jwksCache && (now - jwksCacheTime) < JWKS_CACHE_TTL) {
        return jwksCache;
    }

    const certsUrl = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
    const response = await fetch(certsUrl);

    if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.status}`);
    }

    jwksCache = await response.json();
    jwksCacheTime = now;

    return jwksCache;
}

/**
 * Fetch and cache JWKS from an OIDC provider (Logto)
 */
export async function getOidcJWKS(issuer, jwksUri) {
    const now = Date.now();
    if (oidcJwksCache && (now - oidcJwksCacheTime) < JWKS_CACHE_TTL) {
        return oidcJwksCache;
    }

    const url = jwksUri || `${issuer}/jwks`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch OIDC JWKS from ${url}: ${response.status}`);
    }

    oidcJwksCache = await response.json();
    oidcJwksCacheTime = now;
    return oidcJwksCache;
}

/**
 * Decode base64url to Uint8Array
 */
export function base64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Import RSA public key from JWK
 */
export async function importPublicKey(jwk) {
    return await crypto.subtle.importKey(
        'jwk',
        { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
    );
}

/**
 * Compute SHA256 hash of a string
 */
export async function sha256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
