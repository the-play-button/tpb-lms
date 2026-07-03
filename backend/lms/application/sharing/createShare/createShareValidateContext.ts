import { succeed, type Result } from '../../../domain/core/Result.js';
import type { ShareContentContext } from './createShareHydrateContext.js';

/**
 * ValidateContext step: domain invariants (actor-independent).
 *
 * No domain invariants to enforce beyond what HydrateContext already guarantees
 * (contentRef exists, shares loaded). Pass-through for now.
 */
export const createShareValidateContext = (_context: ShareContentContext): Result<string, void> => {
  return succeed(undefined);
};
