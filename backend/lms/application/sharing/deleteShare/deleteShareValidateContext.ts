import { succeed, type Result } from '../../../domain/core/Result.js';
import type { RevokeShareContext } from './deleteShareHydrateContext.js';

/**
 * ValidateContext step: domain invariants (actor-independent).
 *
 * HydrateContext already ensures the share is active and the contentRef exists.
 * No additional domain invariants to enforce.
 */
export const deleteShareValidateContext = (_context: RevokeShareContext): Result<string, void> => {
  return succeed(undefined);
};
