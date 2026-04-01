import { succeed, type Result } from '../../../domain/core/Result.js';

/**
 * ValidateInput step: no input parameters to validate for this use-case.
 * Authentication is enforced at the middleware layer.
 */
export const getDefaultConnectionValidateInput = (): Result<string, void> => {
  return succeed(undefined);
};
