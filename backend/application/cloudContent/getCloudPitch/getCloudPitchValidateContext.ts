import { succeed, type Result } from '../../../domain/core/Result.js';
import type { GetCloudPitchContext } from './getCloudPitchHydrateContext.js';

/**
 * ValidateContext step: domain invariants (actor-independent).
 *
 * HydrateContext already ensures the contentRef exists and determines
 * ownership/enrollment. No additional domain invariants to enforce.
 */
export const getCloudPitchValidateContext = (_context: GetCloudPitchContext): Result<string, void> => {
  return succeed(undefined);
};
