import type { HandlerUserContext } from '../types/HandlerContext.types.js';

export interface RoleGuardError {
  error: string;
  requiredRole: string[];
  actualRole: string;
}
