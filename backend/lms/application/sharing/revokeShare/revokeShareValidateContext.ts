import { succeed, type Result } from '../../../domain/core/Result.js';
import type { RevokeShareContext } from './revokeShareHydrateContext.js';

/**
 * ValidateContext step: domain invariants (actor-independent).
 *
 * HydrateContext already ensures the share is active and the contentRef exists.
 * No additional domain invariants to enforce.
 */
export const revokeShareValidateContext = (_context: RevokeShareContext): Result<string, void> => {
  return succeed(undefined);
};
