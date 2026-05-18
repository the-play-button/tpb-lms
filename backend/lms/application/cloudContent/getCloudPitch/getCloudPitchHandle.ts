import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { getCloudPitchValidateInput } from './getCloudPitchValidateInput.js';
import { getCloudPitchHydrateContext } from './getCloudPitchHydrateContext.js';
import { getCloudPitchValidateContext } from './getCloudPitchValidateContext.js';
import { getCloudPitchCheckPolicies } from './getCloudPitchCheckPolicies.js';
import { getCloudPitchExecute, type GetCloudPitchOutput } from './getCloudPitchExecute.js';
import { getCloudPitchFilter } from './getCloudPitchFilter.js';
import { getCloudPitchTrack } from './getCloudPitchTrack.js';

type GetCloudPitchError = 'NOT_FOUND' | 'FORBIDDEN' | string;

/**
 * Handle orchestrator: ValidateInput -> HydrateContext -> ValidateContext -> CheckPolicies -> Execute -> Filter -> Track
 */
export const getCloudPitchHandle = async (request: Request, ctx: HandlerContext): Promise<Result<GetCloudPitchError, GetCloudPitchOutput>> => {
  // 1. ValidateInput
  const inputResult = getCloudPitchValidateInput(request);
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const contextResult = await getCloudPitchHydrateContext(inputResult.value, ctx);
  if (!contextResult.ok) return fail(contextResult.error);

  // 3. ValidateContext
  const validateContextResult = getCloudPitchValidateContext(contextResult.value);
  if (!validateContextResult.ok) return fail(validateContextResult.error);

  // 4. CheckPolicies
  const policyResult = await getCloudPitchCheckPolicies(contextResult.value, ctx);
  if (!policyResult.ok) return fail(policyResult.error);

  // 5. Execute
  const executeResult = await getCloudPitchExecute(contextResult.value, ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  // 6. Filter
  const filtered = getCloudPitchFilter(executeResult.value);

  // 7. Track
  getCloudPitchTrack(ctx.actor, inputResult.value.ref_id);

  return { ok: true, value: filtered };
};
