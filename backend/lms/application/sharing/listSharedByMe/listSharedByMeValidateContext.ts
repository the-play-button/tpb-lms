import { succeed, type Result } from '../../../domain/core/Result.js';

/**
 * ValidateContext step: no domain invariants to enforce for listSharedByMe listing.
 */
export const listSharedByMeValidateContext = (): Result<string, void> => {
  return succeed(undefined);
};
