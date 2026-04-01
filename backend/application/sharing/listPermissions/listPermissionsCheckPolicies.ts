import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { ListPermissionsContext } from './listPermissionsHydrateContext.js';

/**
 * CheckPolicies step: only the content owner can list permissions.
 */
export const listPermissionsCheckPolicies = (context: ListPermissionsContext): Result<'FORBIDDEN', 'allowed'> => {
  if (!context.isOwner) {
    return fail('FORBIDDEN' as const);
  }

  return succeed('allowed' as const);
};
