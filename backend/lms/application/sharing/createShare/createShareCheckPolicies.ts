import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import { Email } from '../../../domain/value-objects/index.js';
import { onlyOwnerCanSharePolicy, maxSharesPolicy } from '../../../domain/policies/SharingPolicies.js';
import type { ShareContentContext } from './createShareHydrateContext.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { hasScope } from '@the-play-button/tpb-sdk-js';

/**
 * CheckPolicies step: enforce sharing rules.
 *
 * 1. Delegated authz check via bastion (lms:create on share)
 * 2. Domain rules: only content owner can share, max shares limit
 */
export const createShareCheckPolicies = async (context: ShareContentContext, userEmail: string, ctx: HandlerContext): Promise<Result<string, 'allowed'>> => {
  const { actor } = ctx;
  // § AUTHZ — PBAC FIRST : local literal-scope check (lms doctrine — cf. AuthoringContext.ts:
  // "scope checks on the actor (hasScope), not ReBAC delegated authz"). id:'*' was a capability
  // check, so a delegated ReBAC where a local hasScope is the correct form. Domain rules below unchanged.
  if (!hasScope(actor.scopes ?? [], 'lms:create')) return fail('FORBIDDEN');

  const emailResult = Email.create(userEmail);
  if (!emailResult.ok) return fail(emailResult.error);

  const ownerCheck = onlyOwnerCanSharePolicy(context.contentRef, emailResult.value);
  if (!ownerCheck.ok) return fail(ownerCheck.error);

  const maxCheck = maxSharesPolicy(context.existingShares);
  if (!maxCheck.ok) return fail(maxCheck.error);

  return succeed('allowed' as const);
};
