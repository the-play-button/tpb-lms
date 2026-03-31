import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { revokeShareAssert } from './revokeShareAssert.js';
import { revokeShareHydrateContext } from './revokeShareHydrateContext.js';
import { revokeShareCheckPolicies } from './revokeShareCheckPolicies.js';
import { revokeShareExecute, type RevokeShareOutput } from './revokeShareExecute.js';

type RevokeShareError = 'NOT_FOUND' | 'FORBIDDEN' | string;

/**
 * Handle orchestrator: Assert -> HydrateContext -> CheckPolicies -> Execute
 * shareId comes from the URL path param (no body parsing needed for DELETE).
 */
export const revokeShareHandle = async (shareId: string, ctx: HandlerContext): Promise<Result<RevokeShareError, RevokeShareOutput>> => {
  // 0. Assert
  const assertResult = revokeShareAssert(shareId);
  if (!assertResult.ok) return fail(assertResult.error);

  // 1. HydrateContext
  const contextResult = await revokeShareHydrateContext(shareId, ctx);
  if (!contextResult.ok) return fail(contextResult.error);

  // 2. CheckPolicies
  const policyResult = revokeShareCheckPolicies(contextResult.value);
  if (!policyResult.ok) return fail(policyResult.error);

  // 3. Execute
  const executeResult = await revokeShareExecute(contextResult.value, ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  return { ok: true, value: executeResult.value };
};
