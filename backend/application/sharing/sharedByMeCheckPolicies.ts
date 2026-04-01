import { succeed, type Result } from '../../domain/core/Result.js';

/**
 * CheckPolicies step: authentication is enforced at the middleware layer.
 * Users can only list their own shared content (scoped by email in Execute).
 */
export const sharedByMeCheckPolicies = (): Result<string, 'allowed'> => {
  return succeed('allowed' as const);
};
