import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { GetCloudContentContext } from './getCloudContentHydrateContext.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { log } from '@the-play-button/tpb-sdk-js';

/**
 * CheckPolicies step: enforce content access rules.
 *
 * 1. Delegated authz check via bastion (lms:read on cloud_content)
 * 2. Domain rules: owner/admin always allowed, learner must be enrolled
 */
export const getCloudContentCheckPolicies = async (context: GetCloudContentContext, ctx: HandlerContext): Promise<Result<'FORBIDDEN', 'allowed'>> => {
  const { actor, authzBastionClient } = ctx;
  const authzResult = await authzBastionClient.checkAuthzDelegated(
    { type: actor.type, id: actor.id, context: { scopes: actor.scopes, roles: actor.roles, email: actor.email ?? undefined } },
    'lms:read',
    { namespace: 'lms', type: 'cloud_content', id: '*' },
  );
  if (!authzResult.ok) { log.error(`[CheckPolicies] ${authzResult.error}`); return fail('FORBIDDEN' as const); }
  if (!authzResult.value) return fail('FORBIDDEN' as const);

  if (context.isOwner) {
    return succeed('allowed' as const);
  }

  if (context.isEnrolled) {
    return succeed('allowed' as const);
  }

  return fail('FORBIDDEN' as const);
};
