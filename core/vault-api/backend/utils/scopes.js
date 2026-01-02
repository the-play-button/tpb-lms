/**
 * Scope Utilities for vault-api
 * 
 * Generic scope validation - no app-specific logic.
 * Scope format: namespace:resource:action
 * 
 * Examples:
 *   - lms:role:* (all actions on roles for lms namespace)
 *   - lms:* (all resources for lms namespace)
 *   - * (superadmin, all access)
 */

/**
 * Extract resource type from URL path
 * 
 * @param {string} path - URL pathname
 * @returns {string|null} - Resource type: 'user', 'role', 'group', 'permission', etc.
 */
export function extractResource(path) {
  // IAM resources
  const iamPatterns = [
    { pattern: /^\/iam\/users/, resource: 'user' },
    { pattern: /^\/iam\/roles/, resource: 'role' },
    { pattern: /^\/iam\/groups/, resource: 'group' },
    { pattern: /^\/iam\/permissions/, resource: 'permission' },
    { pattern: /^\/iam\/applications/, resource: 'application' },
    { pattern: /^\/iam\/organizations/, resource: 'organization' },
    { pattern: /^\/iam\/service-tokens/, resource: 'service-token' },
    { pattern: /^\/iam\/can/, resource: 'can' },
    { pattern: /^\/iam\/me/, resource: 'me' },
  ];
  
  // Vault resources
  const vaultPatterns = [
    { pattern: /^\/vault\/connections/, resource: 'connection' },
  ];
  
  for (const p of [...iamPatterns, ...vaultPatterns]) {
    if (p.pattern.test(path)) {
      return p.resource;
    }
  }
  
  return null;
}

/**
 * Map HTTP method to action
 * 
 * @param {string} method - HTTP method
 * @returns {string} - Action: 'read', 'create', 'update', 'delete'
 */
export function methodToAction(method) {
  const mapping = {
    'GET': 'read',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete'
  };
  return mapping[method] || 'read';
}

/**
 * Check if a scope matches a requested operation
 * 
 * Scope format: namespace:resource:action
 * Wildcard: * matches anything at that level
 * 
 * @param {string} scope - Single scope string (e.g., 'lms:role:*')
 * @param {string} required - Required scope (e.g., 'lms:role:create')
 * @returns {boolean}
 */
export function scopeMatches(scope, required) {
  // Superadmin wildcard
  if (scope === '*') return true;
  
  const scopeParts = scope.split(':');
  const requiredParts = required.split(':');
  
  // Must have same number of parts (or scope has wildcards)
  for (let i = 0; i < requiredParts.length; i++) {
    const scopePart = scopeParts[i];
    const requiredPart = requiredParts[i];
    
    // If scope part is missing, no match
    if (scopePart === undefined) return false;
    
    // Wildcard matches anything
    if (scopePart === '*') continue;
    
    // Exact match required
    if (scopePart !== requiredPart) return false;
  }
  
  return true;
}

/**
 * Check if any scope in a list matches the required operation
 * 
 * @param {string|string[]} scopes - Comma-separated string or array of scopes
 * @param {string} required - Required scope
 * @returns {boolean}
 */
export function hasRequiredScope(scopes, required) {
  if (!scopes) return false;
  
  const scopeList = Array.isArray(scopes) 
    ? scopes 
    : scopes.split(',').map(s => s.trim());
  
  return scopeList.some(scope => scopeMatches(scope, required));
}

/**
 * Check if actor has permission for the requested operation
 * 
 * @param {object} actor - Actor object with namespace and scopes
 * @param {string} method - HTTP method
 * @param {string} path - URL pathname
 * @returns {{allowed: boolean, reason?: string}}
 */
export function checkScopeAuthorization(actor, method, path) {
  // Users with admin/superadmin role always allowed
  if (actor.type === 'user' && ['admin', 'superadmin'].includes(actor.role)) {
    return { allowed: true };
  }
  
  // Service tokens need scope check
  if (actor.type === 'service_token') {
    const resource = extractResource(path);
    const action = methodToAction(method);
    
    // Build required scope using actor's namespace
    const namespace = actor.namespace || '*';
    const requiredScope = `${namespace}:${resource}:${action}`;
    
    if (hasRequiredScope(actor.scopes, requiredScope)) {
      return { allowed: true };
    }
    
    // Also check namespace:resource:* (wildcard action)
    if (hasRequiredScope(actor.scopes, `${namespace}:${resource}:*`)) {
      return { allowed: true };
    }
    
    // Also check namespace:* (wildcard resource)
    if (hasRequiredScope(actor.scopes, `${namespace}:*`)) {
      return { allowed: true };
    }
    
    return { 
      allowed: false, 
      reason: `Missing scope: ${requiredScope}. Have: ${actor.scopes?.join(', ') || 'none'}`
    };
  }
  
  // Default deny
  return { allowed: false, reason: 'Unknown actor type' };
}

