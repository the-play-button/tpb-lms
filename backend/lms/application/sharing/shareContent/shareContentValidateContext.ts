import { succeed, type Result } from '../../../domain/core/Result.js';
import type { ShareContentContext } from './shareContentHydrateContext.js';

/**
 * ValidateContext step: domain invariants (actor-independent).
 *
 * No domain invariants to enforce beyond what HydrateContext already guarantees
 * (contentRef exists, shares loaded). Pass-through for now.
 */
export const shareContentValidateContext = (_context: ShareContentContext): Result<string, void> => {
  return succeed(undefined);
};
