import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { RevokeShareContext } from './revokeShareHydrateContext.js';

/**
 * CheckPolicies step: only the content owner can revoke shares.
 */
export function revokeShareCheckPolicies(
  context: RevokeShareContext
): Result<'FORBIDDEN', 'allowed'> {
  if (!context.isOwner) {
    return fail('FORBIDDEN' as const);
  }

  return succeed('allowed' as const);
}
