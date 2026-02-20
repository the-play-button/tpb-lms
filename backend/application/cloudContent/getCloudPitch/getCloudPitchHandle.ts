import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { getCloudPitchAssert } from './getCloudPitchAssert.js';
import { getCloudPitchValidateInput } from './getCloudPitchValidateInput.js';
import { getCloudPitchHydrateContext } from './getCloudPitchHydrateContext.js';
import { getCloudPitchCheckPolicies } from './getCloudPitchCheckPolicies.js';
import { getCloudPitchExecute, type GetCloudPitchOutput } from './getCloudPitchExecute.js';

type GetCloudPitchError = 'NOT_FOUND' | 'FORBIDDEN' | string;

/**
 * Handle orchestrator: Assert -> ValidateInput -> HydrateContext -> CheckPolicies -> Execute
 *
 * No separate Filter step for binary pitch files -- no metadata to strip.
 */
export async function getCloudPitchHandle(
  request: Request,
  ctx: HandlerContext
): Promise<Result<GetCloudPitchError, GetCloudPitchOutput>> {
  // 0. Assert
  const assertResult = getCloudPitchAssert(request);
  if (!assertResult.ok) return fail(assertResult.error);

  // 1. ValidateInput
  const inputResult = getCloudPitchValidateInput(request);
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const contextResult = await getCloudPitchHydrateContext(inputResult.value, ctx);
  if (!contextResult.ok) return fail(contextResult.error);

  // 3. CheckPolicies
  const policyResult = getCloudPitchCheckPolicies(contextResult.value);
  if (!policyResult.ok) return fail(policyResult.error);

  // 4. Execute
  const executeResult = await getCloudPitchExecute(contextResult.value, ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  return { ok: true, value: executeResult.value };
}
