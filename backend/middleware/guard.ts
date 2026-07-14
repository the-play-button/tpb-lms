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
import type { HandlerUserContext } from '../types/HandlerContext.js';

import type { RoleGuardError } from './guard.types';
export type { RoleGuardError };



export const requireRole = (...allowedRoles: string[]) => {
  return (userContext: HandlerUserContext | null | undefined): RoleGuardError | null => {
    const role = userContext?.user?.role ?? 'student';

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

