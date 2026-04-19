import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { revokeShareValidateInput } from './revokeShareValidateInput.js';
import { revokeShareHydrateContext } from './revokeShareHydrateContext.js';
import { revokeShareValidateContext } from './revokeShareValidateContext.js';
import { revokeShareCheckPolicies } from './revokeShareCheckPolicies.js';
import { revokeShareExecute, type RevokeShareOutput } from './revokeShareExecute.js';
import { revokeShareFilter } from './revokeShareFilter.js';
import { revokeShareTrack } from './revokeShareTrack.js';

type RevokeShareError = 'NOT_FOUND' | 'FORBIDDEN' | string;

/**
 * Handle orchestrator: ValidateInput -> HydrateContext -> ValidateContext -> CheckPolicies -> Execute -> Filter -> Track
 */
export const revokeShareHandle = async (shareId: string, ctx: HandlerContext): Promise<Result<RevokeShareError, RevokeShareOutput>> => {
  // 1. ValidateInput
  const inputResult = revokeShareValidateInput(shareId);
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const contextResult = await revokeShareHydrateContext(inputResult.value.share_id, ctx);
  if (!contextResult.ok) return fail(contextResult.error);

  // 3. ValidateContext
  const validateContextResult = revokeShareValidateContext(contextResult.value);
  if (!validateContextResult.ok) return fail(validateContextResult.error);

  // 4. CheckPolicies
  const policyResult = await revokeShareCheckPolicies(contextResult.value, ctx);
  if (!policyResult.ok) return fail(policyResult.error);

  // 5. Execute
  const executeResult = await revokeShareExecute(contextResult.value, ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  // 6. Filter
  const filtered = revokeShareFilter(executeResult.value);

  // 7. Track
  revokeShareTrack(inputResult.value.share_id);

  return { ok: true, value: filtered };
};
