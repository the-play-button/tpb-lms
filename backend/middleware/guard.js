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
export const requireRole = (...allowedRoles) => {
  return (userContext) => {
    const { user: { role = 'student' } = {} } = userContext ?? {};
    
    if (!allowedRoles.includes(role)) {
      return { 
        error: 'Forbidden', 
        requiredRole: allowedRoles,
        actualRole: role 
      };
    }
    
    return null; // OK - no error
  };
};

