/**
 * Authentication Module
 * 
 * Supports multiple auth methods (checked in order):
 * 1. JWT (Cf-Access-Jwt-Assertion) - Browser users + CF Service Tokens
 * 2. API Key (Authorization: Bearer) - Scripts, integrations
 * 
 * Security model:
 * - JWT: Signature verification via JWKS, expiration check
 * - API Key: SHA256 hash lookup in DB, expiration check
 * 
 * Role resolution:
 * - Uses vault-api as SSOT for IAM (OAuth-ready abstraction)
 * - Falls back to local hris_employee if vault-api unavailable
 * 
 * Uses crm_contact for external users (Unified.to aligned)
 */

import { jsonResponse } from './cors.js';
import { VaultClient } from './lib/vaultClient.js';
import { getAuthConfig } from './config/auth.js';

// Cache for JWKS keys
let jwksCache = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour

// ============================================
// JWT Authentication (Cloudflare Access)
// ============================================

/**
 * Fetch and cache JWKS from Cloudflare Access
 */
async function getJWKS(teamDomain) {
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
 * Decode base64url to Uint8Array
 */
function base64urlDecode(str) {
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
async function importPublicKey(jwk) {
    return await crypto.subtle.importKey(
        'jwk',
        { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
    );
}

/**
 * Verify Cloudflare Access JWT
 */
export async function verifyAccessJWT(token, env) {
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
        
        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return { valid: false, error: 'Token expired' };
        }
        
        // Get JWKS and verify signature
        const teamDomain = env.ACCESS_TEAM_DOMAIN || 'theplaybutton';
        const jwks = await getJWKS(teamDomain);
        const key = jwks.keys.find(k => k.kid === header.kid);
        
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
}

// ============================================
// API Key Authentication
// ============================================

/**
 * Compute SHA256 hash of a string
 */
async function sha256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify API Key against database
 */
export async function verifyAPIKey(apiKey, env) {
    if (!apiKey) {
        return { valid: false, error: 'No API key provided' };
    }
    
    // Validate format (must start with tpb_)
    if (!apiKey.startsWith('tpb_')) {
        return { valid: false, error: 'Invalid API key format' };
    }
    
    try {
        const keyHash = await sha256(apiKey);
        
        const record = await env.DB.prepare(`
            SELECT id, name, user_id, scopes, expires_at, is_active
            FROM api_key 
            WHERE key_hash = ? AND is_active = 1
        `).bind(keyHash).first();
        
        if (!record) {
            return { valid: false, error: 'Invalid API key' };
        }
        
        // Check expiration
        if (record.expires_at && new Date(record.expires_at) < new Date()) {
            return { valid: false, error: 'API key expired' };
        }
        
        // Update last_used_at (fire and forget)
        env.DB.prepare(`
            UPDATE api_key SET last_used_at = ? WHERE id = ?
        `).bind(new Date().toISOString(), record.id).run();
        
        return { 
            valid: true, 
            keyId: record.id,
            keyName: record.name,
            userId: record.user_id,
            scopes: record.scopes,
            authMethod: 'api_key'
        };
        
    } catch (error) {
        console.error('API Key verification error:', error);
        return { valid: false, error: error.message };
    }
}

/**
 * Generate a new API Key
 * Returns the key only once - must be shown to user immediately
 */
export async function generateAPIKey(name, userId, env, options = {}) {
    const key = 'tpb_' + crypto.randomUUID().replace(/-/g, '');
    const keyHash = await sha256(key);
    const keyPrefix = key.substring(0, 12); // tpb_ + 8 chars
    
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const scopes = options.scopes || '*';
    const expiresAt = options.expiresAt || null;
    
    await env.DB.prepare(`
        INSERT INTO api_key (id, name, key_hash, key_prefix, user_id, scopes, expires_at, created_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(id, name, keyHash, keyPrefix, userId, scopes, expiresAt, now).run();
    
    return {
        id,
        key, // Only returned at creation time!
        prefix: keyPrefix,
        name,
        scopes,
        expiresAt,
        createdAt: now
    };
}

// ============================================
// User Resolution
// ============================================

/**
 * Resolve user role from email
 * 
 * Strategy:
 * 1. Try vault-api (SSOT for IAM) - returns raw roles
 * 2. Apply LMS-specific mapping to vault roles
 * 3. Fallback to local hris_employee if vault-api unavailable
 * 
 * LMS Role Mapping (app-specific, NOT in vault-api):
 * - vault role 'lms_admin' -> 'admin'
 * - vault role 'lms_instructor' -> 'instructor'
 * - no matching role -> 'student' (default)
 * 
 * @param {string} email - User email
 * @param {object} env - Worker env
 * @returns {Promise<string>} - Role: 'admin', 'instructor', or 'student'
 */
export async function resolveRole(email, env) {
  // Try vault-api first (SSOT for IAM)
  if (env.VAULT_API_URL && env.VAULT_CLIENT_ID && env.VAULT_CLIENT_SECRET) {
    try {
      const vault = new VaultClient(env.VAULT_API_URL, env);
      const data = await vault.getUserRoles(email);
      const roleNames = (data.roles || []).map(r => r.name);
      
      // LMS-SPECIFIC MAPPING (this logic belongs to LMS, not vault-api)
      // Namespace is 'tpblms' so roles are tpblms_admin, tpblms_instructor
      if (roleNames.some(r => r === 'tpblms_admin')) {
        return 'admin';
      }
      if (roleNames.some(r => r === 'tpblms_instructor')) {
        return 'instructor';
      }
      
      // No matching LMS role found = student
      return 'student';
      
    } catch (err) {
      console.error('vault-api role resolution failed, falling back to local:', err.message);
      // Fall through to local resolution
    }
  }
  
  // Fallback: local hris_employee check
  // This will be deprecated once vault-api is fully operational
  const employee = await env.DB.prepare(`
    SELECT id, employee_roles_json FROM hris_employee 
    WHERE json_extract(emails_json, '$[0].email') = ?
  `).bind(email).first();
  
  if (employee) {
    const roles = JSON.parse(employee.employee_roles_json || '[]');
    if (roles.includes('admin')) return 'admin';
    return 'instructor';
  }
  
  // Default: student (external user)
  return 'student';
}

/**
 * Get or create contact in crm_contact (Unified.to aligned)
 */
export async function getOrCreateContact(email, env) {
    // Try to find existing contact
    let contact = await env.DB.prepare(`
        SELECT * FROM crm_contact 
        WHERE json_extract(emails_json, '$[0].email') = ?
           OR id = ?
    `).bind(email, email).first();
    
    if (contact) return contact;
    
    // Create new contact
    const id = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const emailsJson = JSON.stringify([{ email, type: 'WORK' }]);
    
    await env.DB.prepare(`
        INSERT INTO crm_contact (id, emails_json, created_at, updated_at)
        VALUES (?, ?, ?, ?)
    `).bind(id, emailsJson, now, now).run();
    
    return { 
        id, 
        emails_json: emailsJson,
        created_at: now,
        updated_at: now
    };
}

// ============================================
// Logto OIDC JWT Validation
// ============================================

// JWKS cache for OIDC providers
let oidcJwksCache = null;
let oidcJwksCacheTime = 0;

/**
 * Fetch and cache JWKS from an OIDC provider (Logto)
 */
async function getOidcJWKS(issuer, jwksUri) {
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
 * Verify Logto OIDC JWT with full signature validation
 */
export async function verifyOidcJWT(token, env) {
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

        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return { valid: false, error: 'Token expired' };
        }

        // Validate issuer
        if (payload.iss !== authConfig.logto.issuer) {
            return { valid: false, error: `Invalid issuer: ${payload.iss}` };
        }

        // Validate audience if configured
        if (authConfig.logto.appId && payload.aud) {
            const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
            if (!audiences.includes(authConfig.logto.appId)) {
                return { valid: false, error: 'Token not issued for this application' };
            }
        }

        // Verify signature against JWKS
        if (header.kid) {
            const jwks = await getOidcJWKS(authConfig.logto.issuer, authConfig.logto.jwksUri);
            const key = jwks.keys.find(k => k.kid === header.kid);

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
        console.error('OIDC JWT verification error:', error);
        return { valid: false, error: error.message };
    }
}

// ============================================
// Main Authentication Function
// ============================================

/**
 * Authenticate request using JWT OR API Key
 *
 * Checks in order:
 * 1. Cf-Access-Jwt-Assertion header (JWT from CF Access or Logto)
 * 2. Authorization: Bearer header (API Key or Logto OIDC token)
 */
export async function authenticateRequest(request, env) {
    const authConfig = getAuthConfig(env);

    // Try JWT first (browser users + CF Service Tokens)
    let jwtToken = request.headers.get('Cf-Access-Jwt-Assertion');
    let jwtSource = 'cf-access';

    // If no CF Access JWT but Logto is enabled, check Authorization: Bearer for OIDC tokens
    const authHeader = request.headers.get('Authorization');
    if (!jwtToken && authConfig.useLogto && authHeader?.startsWith('Bearer ')) {
        const bearerToken = authHeader.slice(7);
        // OIDC JWTs contain dots, API keys start with tpb_
        if (!bearerToken.startsWith('tpb_') && bearerToken.includes('.')) {
            jwtToken = bearerToken;
            jwtSource = 'bearer-oidc';
        }
    }

    if (jwtToken) {
        // Detect token type by peeking at issuer
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
            // Fallback: try CF Access validation
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

        // JWT was provided but invalid
        return {
            error: jsonResponse({
                error: `Authentication failed: ${jwtResult.error}`,
                authMethod: jwtResult.authMethod || 'jwt'
            }, 403, request)
        };
    }

    // Try API Key (scripts, integrations)
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const apiKey = authHeader.slice(7);
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

        // API Key was provided but invalid
        return {
            error: jsonResponse({
                error: `Authentication failed: ${keyResult.error}`,
                authMethod: 'api_key'
            }, 403, request)
        };
    }

    // No authentication provided
    return {
        error: jsonResponse({
            error: 'Missing authentication. Provide Cf-Access-Jwt-Assertion or Authorization: Bearer header.',
            hint: 'Use JWT for browser access, API Key for programmatic access.'
        }, 401, request)
    };
}
