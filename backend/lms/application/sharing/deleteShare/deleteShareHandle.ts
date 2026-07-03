import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { deleteShareValidateInput } from './deleteShareValidateInput.js';
import { deleteShareHydrateContext } from './deleteShareHydrateContext.js';
import { deleteShareValidateContext } from './deleteShareValidateContext.js';
import { deleteShareCheckPolicies } from './deleteShareCheckPolicies.js';
import { deleteShareExecute, type RevokeShareOutput } from './deleteShareExecute.js';
import { deleteShareFilter } from './deleteShareFilter.js';
import { deleteShareTrack } from './deleteShareTrack.js';

type RevokeShareError = 'NOT_FOUND' | 'FORBIDDEN' | string;

/**
 * Handle orchestrator: ValidateInput -> HydrateContext -> ValidateContext -> CheckPolicies -> Execute -> Filter -> Track
 */
export const deleteShareHandle = async (shareId: string, ctx: HandlerContext): Promise<Result<RevokeShareError, RevokeShareOutput>> => {
  // 1. ValidateInput
  const inputResult = deleteShareValidateInput(shareId);
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const contextResult = await deleteShareHydrateContext(inputResult.value.share_id, ctx);
  if (!contextResult.ok) return fail(contextResult.error);

  // 3. ValidateContext
  const validateContextResult = deleteShareValidateContext(contextResult.value);
  if (!validateContextResult.ok) return fail(validateContextResult.error);

  // 4. CheckPolicies
  const policyResult = await deleteShareCheckPolicies(contextResult.value, ctx);
  if (!policyResult.ok) return fail(policyResult.error);

  // 5. Execute
  const executeResult = await deleteShareExecute(contextResult.value, ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  // 6. Filter
  const filtered = deleteShareFilter(executeResult.value);

  // 7. Track
  deleteShareTrack(ctx.actor, inputResult.value.share_id);

  return { ok: true, value: filtered };
};
