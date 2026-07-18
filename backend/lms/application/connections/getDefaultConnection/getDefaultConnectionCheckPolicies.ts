import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { hasScope } from '@the-play-button/tpb-sdk-js';

/**
 * CheckPolicies step: delegated authz check via bastion (lms:read on connection).
 * Any authenticated user can get their default connection.
 */
export const getDefaultConnectionCheckPolicies = async (ctx: HandlerContext): Promise<Result<string, 'allowed'>> => {
  const { actor } = ctx;
  // § AUTHZ — PBAC FIRST : local literal-scope check (lms doctrine — cf. AuthoringContext.ts:
  // "scope checks on the actor (hasScope), not ReBAC delegated authz"). id:'*' was a capability
  // check, so a delegated ReBAC where a local hasScope is the correct form. Domain rules below unchanged.
  if (!hasScope(actor.scopes ?? [], 'lms:read')) return fail('FORBIDDEN');
  return succeed('allowed' as const);
};
