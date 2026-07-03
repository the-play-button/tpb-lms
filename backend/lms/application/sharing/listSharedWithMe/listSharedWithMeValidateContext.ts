import { succeed, type Result } from '../../../domain/core/Result.js';

/**
 * ValidateContext step: no domain invariants to enforce for listSharedWithMe listing.
 */
export const listSharedWithMeValidateContext = (): Result<string, void> => {
  return succeed(undefined);
};
