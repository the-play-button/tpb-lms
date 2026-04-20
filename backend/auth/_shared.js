/**
 * Shared auth primitives - JWKS caching, JWT parsing, crypto helpers
 */

export let jwksCache = null;
export let jwksCacheTime = 0;
export const JWKS_CACHE_TTL = 3600000; // 1 hour

/**
 * Fetch and cache JWKS from Cloudflare Access
 */
export const getJWKS = async teamDomain => {
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
};

/**
 * Decode base64url to Uint8Array
 */
export const base64urlDecode = str => {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

/**
 * Import RSA public key from JWK
 */
export const importPublicKey = async jwk => {
    return await crypto.subtle.importKey(
        'jwk',
        { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
    );
};

/**
 * Compute SHA256 hash of a string
 */
export const sha256 = async str => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};
