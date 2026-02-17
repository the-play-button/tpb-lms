import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import { Email } from '../../../domain/value-objects/index.js';
import { onlyOwnerCanSharePolicy, maxSharesPolicy } from '../../../domain/policies/SharingPolicies.js';
import type { ShareContentContext } from './shareContentHydrateContext.js';

/**
 * CheckPolicies step: enforce sharing rules.
 *
 * - Only the content owner can share
 * - Maximum shares limit
 */
export function shareContentCheckPolicies(
  context: ShareContentContext,
  userEmail: string
): Result<string, 'allowed'> {
  const emailResult = Email.create(userEmail);
  if (!emailResult.ok) return fail(emailResult.error);

  const ownerCheck = onlyOwnerCanSharePolicy(context.contentRef, emailResult.value);
  if (!ownerCheck.ok) return fail(ownerCheck.error);

  const maxCheck = maxSharesPolicy(context.existingShares);
  if (!maxCheck.ok) return fail(maxCheck.error);

  return succeed('allowed' as const);
}
