import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import { Email } from '../../../domain/value-objects/index.js';
import { onlyOwnerCanSharePolicy, maxSharesPolicy } from '../../../domain/policies/SharingPolicies.js';
import type { ShareContentContext } from './shareContentHydrateContext.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { log } from '@the-play-button/tpb-sdk-js';

/**
 * CheckPolicies step: enforce sharing rules.
 *
 * 1. Delegated authz check via bastion (lms:create on share)
 * 2. Domain rules: only content owner can share, max shares limit
 */
export const shareContentCheckPolicies = async (context: ShareContentContext, userEmail: string, ctx: HandlerContext): Promise<Result<string, 'allowed'>> => {
  const { actor, authzBastionClient } = ctx;
  const authzResult = await authzBastionClient.checkAuthzDelegated(
    { type: actor.type, id: actor.id, context: { scopes: actor.scopes, roles: actor.roles, email: actor.email ?? undefined } },
    'lms:create',
    { namespace: 'lms', type: 'share', id: '*' },
  );
  if (!authzResult.ok) { log.error(`[CheckPolicies] ${authzResult.error}`); return fail('FORBIDDEN'); }
  if (!authzResult.value) return fail('FORBIDDEN');

  const emailResult = Email.create(userEmail);
  if (!emailResult.ok) return fail(emailResult.error);

  const ownerCheck = onlyOwnerCanSharePolicy(context.contentRef, emailResult.value);
  if (!ownerCheck.ok) return fail(ownerCheck.error);

  const maxCheck = maxSharesPolicy(context.existingShares);
  if (!maxCheck.ok) return fail(maxCheck.error);

  return succeed('allowed' as const);
};
