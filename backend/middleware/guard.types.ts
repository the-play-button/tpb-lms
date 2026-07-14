import type { HandlerUserContext } from '../types/HandlerContext.js';

export interface RoleGuardError {
  error: string;
  requiredRole: string[];
  actualRole: string;
}
