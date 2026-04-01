import { succeed, type Result } from '../../../domain/core/Result.js';

/**
 * CheckPolicies step: authentication is enforced at the middleware layer.
 * Any authenticated user can get their default connection.
 */
export const getDefaultConnectionCheckPolicies = (): Result<string, 'allowed'> => {
  return succeed('allowed' as const);
};
