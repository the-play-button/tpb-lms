import { succeed, type Result } from '../../../domain/core/Result.js';

/**
 * CheckPolicies step: authentication is enforced at the middleware layer.
 * Any authenticated user can list their own connections.
 */
export const listConnectionsCheckPolicies = (): Result<string, 'allowed'> => {
  return succeed('allowed' as const);
};
