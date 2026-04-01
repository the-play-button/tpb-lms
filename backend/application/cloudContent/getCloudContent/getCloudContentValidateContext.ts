import { succeed, type Result } from '../../../domain/core/Result.js';
import type { GetCloudContentContext } from './getCloudContentHydrateContext.js';

/**
 * ValidateContext step: domain invariants (actor-independent).
 *
 * HydrateContext already ensures the contentRef exists and determines
 * ownership/enrollment. No additional domain invariants to enforce.
 */
export const getCloudContentValidateContext = (_context: GetCloudContentContext): Result<string, void> => {
  return succeed(undefined);
};
