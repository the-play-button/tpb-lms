import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { GetCloudPitchContext } from './getCloudPitchHydrateContext.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { hasScope } from '@the-play-button/tpb-sdk-js';

/**
 * CheckPolicies step: enforce content access rules for pitch files.
 *
 * 1. Delegated authz check via bastion (lms:read on cloud_pitch)
 * 2. Domain rules: owner/admin always allowed, learner must be enrolled
 */
export const getCloudPitchCheckPolicies = async (context: GetCloudPitchContext, ctx: HandlerContext): Promise<Result<'FORBIDDEN', 'allowed'>> => {
  const { actor } = ctx;
  // § AUTHZ — PBAC FIRST : local literal-scope check (lms doctrine — cf. AuthoringContext.ts:
  // "scope checks on the actor (hasScope), not ReBAC delegated authz"). id:'*' was a capability
  // check, so a delegated ReBAC where a local hasScope is the correct form. Domain rules below unchanged.
  if (!hasScope(actor.scopes ?? [], 'lms:read')) return fail('FORBIDDEN' as const);

  if (context.isOwner) {
    return succeed('allowed' as const);
  }

  if (context.isEnrolled) {
    return succeed('allowed' as const);
  }

  return fail('FORBIDDEN' as const);
};
