import { fail, succeed, type Result } from '../../domain/core/Result.js';
import type { HandlerContext } from '../../types/HandlerContext.js';
import { log } from '@the-play-button/tpb-sdk-js';

/**
 * CheckPolicies step: delegated authz check via bastion (lms:read on share).
 * Users can only list content shared with them (scoped by email in Execute).
 */
export const sharedWithMeCheckPolicies = async (ctx: HandlerContext): Promise<Result<string, 'allowed'>> => {
  const { actor, authzBastionClient } = ctx;
  const authzResult = await authzBastionClient.checkAuthzDelegated(
    { type: actor.type, id: actor.id, context: { scopes: actor.scopes, roles: actor.roles, email: actor.email ?? undefined } },
    'lms:read',
    { namespace: 'lms', type: 'share', id: '*' },
  );
  if (!authzResult.ok) { log.error(`[CheckPolicies] ${authzResult.error}`); return fail('FORBIDDEN'); }
  if (!authzResult.value) return fail('FORBIDDEN');
  return succeed('allowed' as const);
};
