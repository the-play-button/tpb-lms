import { succeed, type Result } from '../../lms/domain/core/Result.js';

/**
 * ValidateContext step: no domain invariants to enforce for sharedByMe listing.
 */
export const sharedByMeValidateContext = (): Result<string, void> => {
  return succeed(undefined);
};
