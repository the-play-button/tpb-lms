import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { listSharedByMeValidateInput } from './listSharedByMeValidateInput.js';
import { listSharedByMeHydrateContext } from './listSharedByMeHydrateContext.js';
import { listSharedByMeValidateContext } from './listSharedByMeValidateContext.js';
import { listSharedByMeCheckPolicies } from './listSharedByMeCheckPolicies.js';
import { listSharedByMeExecute, type SharedByMeEntry } from './listSharedByMeExecute.js';
import { listSharedByMeFilter } from './listSharedByMeFilter.js';
import { listSharedByMeTrack } from './listSharedByMeTrack.js';

/**
 * Handle orchestrator: ValidateInput -> HydrateContext -> ValidateContext -> CheckPolicies -> Execute -> Filter -> Track
 */
export const listSharedByMeHandle = async (ctx: HandlerContext): Promise<Result<string, SharedByMeEntry[]>> => {
  // 1. ValidateInput
  const inputResult = listSharedByMeValidateInput(ctx.userEmail);
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const hydrateResult = listSharedByMeHydrateContext();
  if (!hydrateResult.ok) return fail(hydrateResult.error);

  // 3. ValidateContext
  const validateContextResult = listSharedByMeValidateContext();
  if (!validateContextResult.ok) return fail(validateContextResult.error);

  // 4. CheckPolicies
  const policyResult = await listSharedByMeCheckPolicies(ctx);
  if (!policyResult.ok) return fail(policyResult.error);

  // 5. Execute
  const executeResult = await listSharedByMeExecute(inputResult.value, ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  // 6. Filter
  const filtered = listSharedByMeFilter(executeResult.value, ctx.userEmail);

  // 7. Track
  listSharedByMeTrack(ctx.actor);

  return { ok: true, value: filtered };
};
