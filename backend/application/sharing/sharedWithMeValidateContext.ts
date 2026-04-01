import { succeed, type Result } from '../../domain/core/Result.js';

/**
 * ValidateContext step: no domain invariants to enforce for sharedWithMe listing.
 */
export const sharedWithMeValidateContext = (): Result<string, void> => {
  return succeed(undefined);
};
