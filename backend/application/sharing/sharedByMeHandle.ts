import type { Result } from '../../domain/core/Result.js';
import { fail } from '../../domain/core/Result.js';
import type { HandlerContext } from '../../types/HandlerContext.js';
import { sharedByMeValidateInput } from './sharedByMeValidateInput.js';
import { sharedByMeHydrateContext } from './sharedByMeHydrateContext.js';
import { sharedByMeValidateContext } from './sharedByMeValidateContext.js';
import { sharedByMeCheckPolicies } from './sharedByMeCheckPolicies.js';
import { sharedByMeExecute, type SharedByMeEntry } from './sharedByMeExecute.js';
import { sharedByMeFilter } from './sharedByMeFilter.js';
import { sharedByMeTrack } from './sharedByMeTrack.js';

/**
 * Handle orchestrator: ValidateInput -> HydrateContext -> ValidateContext -> CheckPolicies -> Execute -> Filter -> Track
 */
export const sharedByMeHandle = async (ctx: HandlerContext): Promise<Result<string, SharedByMeEntry[]>> => {
  // 1. ValidateInput
  const inputResult = sharedByMeValidateInput(ctx.userEmail);
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const hydrateResult = sharedByMeHydrateContext();
  if (!hydrateResult.ok) return fail(hydrateResult.error);

  // 3. ValidateContext
  const validateContextResult = sharedByMeValidateContext();
  if (!validateContextResult.ok) return fail(validateContextResult.error);

  // 4. CheckPolicies
  const policyResult = sharedByMeCheckPolicies();
  if (!policyResult.ok) return fail(policyResult.error);

  // 5. Execute
  const executeResult = await sharedByMeExecute(inputResult.value, ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  // 6. Filter
  const filtered = sharedByMeFilter(executeResult.value, ctx.userEmail);

  // 7. Track
  sharedByMeTrack(ctx);

  return { ok: true, value: filtered };
};
