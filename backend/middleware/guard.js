/**
 * Role Guard Middleware
 * 
 * Intent + Guard pattern for RBAC
 * Usage: const guardResult = requireRole('admin', 'instructor')(userContext);
 */

/**
 * Check if user has required role
 * @param {...string} allowedRoles - Roles that are allowed (e.g., 'admin', 'instructor', 'student')
 * @returns {Function} Guard function that takes userContext
 */
export function requireRole(...allowedRoles) {
  return (userContext) => {
    const role = userContext?.user?.role || 'student';
    
    if (!allowedRoles.includes(role)) {
      return { 
        error: 'Forbidden', 
        requiredRole: allowedRoles,
        actualRole: role 
      };
    }
    
    return null; // OK - no error
  };
}

/**
 * Check if user has any of the required roles
 * Alias for requireRole for clarity
 */
export const requireAnyRole = requireRole;

/**
 * Check if user has ALL of the required roles (admin only for now)
 * @param {...string} requiredRoles
 */
export function requireAllRoles(...requiredRoles) {
  return (userContext) => {
    const role = userContext?.user?.role || 'student';
    
    // For simplicity, only admin has all permissions
    if (role !== 'admin' && requiredRoles.length > 0) {
      return { 
        error: 'Forbidden - insufficient permissions',
        requiredRoles,
        actualRole: role
      };
    }
    
    return null; // OK
  };
}

