import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { GetCloudContentContext } from './getCloudContentHydrateContext.js';

/**
 * CheckPolicies step: enforce content access rules.
 *
 * - Owner/admin -> always allowed
 * - Learner -> must be enrolled (has active share)
 */
export const getCloudContentCheckPolicies = (context: GetCloudContentContext): Result<'FORBIDDEN', 'allowed'> => {
  if (context.isOwner) {
    return succeed('allowed' as const);
  }

  if (context.isEnrolled) {
    return succeed('allowed' as const);
  }

  return fail('FORBIDDEN' as const);
};
