import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { GetCloudPitchContext } from './getCloudPitchHydrateContext.js';

/**
 * CheckPolicies step: enforce content access rules for pitch files.
 *
 * - Owner/admin -> always allowed
 * - Learner -> must be enrolled (has active share)
 */
export function getCloudPitchCheckPolicies(
  context: GetCloudPitchContext
): Result<'FORBIDDEN', 'allowed'> {
  if (context.isOwner) {
    return succeed('allowed' as const);
  }

  if (context.isEnrolled) {
    return succeed('allowed' as const);
  }

  return fail('FORBIDDEN' as const);
}
