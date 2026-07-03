import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { RevokeShareContext } from './deleteShareHydrateContext.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { log } from '@the-play-button/tpb-sdk-js';

/**
 * CheckPolicies step: delegated authz check + only the content owner can revoke shares.
 */
export const deleteShareCheckPolicies = async (context: RevokeShareContext, ctx: HandlerContext): Promise<Result<'FORBIDDEN', 'allowed'>> => {
  const { actor, authzBastionClient } = ctx;
  const authzResult = await authzBastionClient.checkAuthzDelegated(
    { type: actor.type, id: actor.id, scopes: actor.scopes || [], groupIds: actor.groupIds || [], context: { roles: actor.roles, email: actor.email ?? undefined } },
    'lms:delete',
    { namespace: 'lms', type: 'share', id: '*' },
  );
  if (!authzResult.ok) { log.error(`[CheckPolicies] ${authzResult.error}`); return fail('FORBIDDEN' as const); }
  if (!authzResult.value) return fail('FORBIDDEN' as const);

  if (!context.isOwner) {
    return fail('FORBIDDEN' as const);
  }

  return succeed('allowed' as const);
};
