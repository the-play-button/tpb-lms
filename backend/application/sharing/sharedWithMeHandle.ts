import type { Result } from '../../domain/core/Result.js';
import { fail } from '../../domain/core/Result.js';
import type { HandlerContext } from '../../types/HandlerContext.js';
import { sharedWithMeValidateInput } from './sharedWithMeValidateInput.js';
import { sharedWithMeHydrateContext } from './sharedWithMeHydrateContext.js';
import { sharedWithMeValidateContext } from './sharedWithMeValidateContext.js';
import { sharedWithMeCheckPolicies } from './sharedWithMeCheckPolicies.js';
import { sharedWithMeExecute, type SharedWithMeEntry } from './sharedWithMeExecute.js';
import { sharedWithMeFilter } from './sharedWithMeFilter.js';
import { sharedWithMeTrack } from './sharedWithMeTrack.js';

/**
 * Handle orchestrator: ValidateInput -> HydrateContext -> ValidateContext -> CheckPolicies -> Execute -> Filter -> Track
 */
export const sharedWithMeHandle = async (ctx: HandlerContext): Promise<Result<string, SharedWithMeEntry[]>> => {
  // 1. ValidateInput
  const inputResult = sharedWithMeValidateInput(ctx.userEmail);
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const hydrateResult = sharedWithMeHydrateContext();
  if (!hydrateResult.ok) return fail(hydrateResult.error);

  // 3. ValidateContext
  const validateContextResult = sharedWithMeValidateContext();
  if (!validateContextResult.ok) return fail(validateContextResult.error);

  // 4. CheckPolicies
  const policyResult = await sharedWithMeCheckPolicies(ctx);
  if (!policyResult.ok) return fail(policyResult.error);

  // 5. Execute
  const executeResult = await sharedWithMeExecute(inputResult.value, ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  // 6. Filter
  const filtered = sharedWithMeFilter(executeResult.value, ctx.userEmail);

  // 7. Track
  sharedWithMeTrack();

  return { ok: true, value: filtered };
};
