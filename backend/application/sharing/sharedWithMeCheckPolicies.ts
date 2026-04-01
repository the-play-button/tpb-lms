import { succeed, type Result } from '../../domain/core/Result.js';

/**
 * CheckPolicies step: authentication is enforced at the middleware layer.
 * Users can only list content shared with them (scoped by email in Execute).
 */
export const sharedWithMeCheckPolicies = (): Result<string, 'allowed'> => {
  return succeed('allowed' as const);
};
