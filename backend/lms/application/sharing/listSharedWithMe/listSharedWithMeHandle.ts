import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { listSharedWithMeValidateInput } from './listSharedWithMeValidateInput.js';
import { listSharedWithMeHydrateContext } from './listSharedWithMeHydrateContext.js';
import { listSharedWithMeValidateContext } from './listSharedWithMeValidateContext.js';
import { listSharedWithMeCheckPolicies } from './listSharedWithMeCheckPolicies.js';
import { listSharedWithMeExecute, type SharedWithMeEntry } from './listSharedWithMeExecute.js';
import { listSharedWithMeFilter } from './listSharedWithMeFilter.js';
import { listSharedWithMeTrack } from './listSharedWithMeTrack.js';

/**
 * Handle orchestrator: ValidateInput -> HydrateContext -> ValidateContext -> CheckPolicies -> Execute -> Filter -> Track
 */
export const listSharedWithMeHandle = async (ctx: HandlerContext): Promise<Result<string, SharedWithMeEntry[]>> => {
  // 1. ValidateInput
  const inputResult = listSharedWithMeValidateInput(ctx.userEmail);
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const hydrateResult = listSharedWithMeHydrateContext();
  if (!hydrateResult.ok) return fail(hydrateResult.error);

  // 3. ValidateContext
  const validateContextResult = listSharedWithMeValidateContext();
  if (!validateContextResult.ok) return fail(validateContextResult.error);

  // 4. CheckPolicies
  const policyResult = await listSharedWithMeCheckPolicies(ctx);
  if (!policyResult.ok) return fail(policyResult.error);

  // 5. Execute
  const executeResult = await listSharedWithMeExecute(inputResult.value, ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  // 6. Filter
  const filtered = listSharedWithMeFilter(executeResult.value, ctx.userEmail);

  // 7. Track
  listSharedWithMeTrack(ctx.actor);

  return { ok: true, value: filtered };
};
