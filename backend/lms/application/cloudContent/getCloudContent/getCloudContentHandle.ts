import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { getCloudContentValidateInput } from './getCloudContentValidateInput.js';
import { getCloudContentHydrateContext } from './getCloudContentHydrateContext.js';
import { getCloudContentValidateContext } from './getCloudContentValidateContext.js';
import { getCloudContentCheckPolicies } from './getCloudContentCheckPolicies.js';
import { getCloudContentExecute, type GetCloudContentOutput } from './getCloudContentExecute.js';
import { getCloudContentFilter } from './getCloudContentFilter.js';
import { getCloudContentTrack } from './getCloudContentTrack.js';

type GetCloudContentError = 'NOT_FOUND' | 'FORBIDDEN' | string;

/**
 * Handle orchestrator: ValidateInput -> HydrateContext -> ValidateContext -> CheckPolicies -> Execute -> Filter -> Track
 */
export const getCloudContentHandle = async (request: Request, ctx: HandlerContext): Promise<Result<GetCloudContentError, GetCloudContentOutput>> => {
  // 1. ValidateInput
  const inputResult = getCloudContentValidateInput(request);
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const contextResult = await getCloudContentHydrateContext(inputResult.value, ctx);
  if (!contextResult.ok) return fail(contextResult.error);

  // 3. ValidateContext
  const validateContextResult = getCloudContentValidateContext(contextResult.value);
  if (!validateContextResult.ok) return fail(validateContextResult.error);

  // 4. CheckPolicies
  const policyResult = await getCloudContentCheckPolicies(contextResult.value, ctx);
  if (!policyResult.ok) return fail(policyResult.error);

  // 5. Execute
  const executeResult = await getCloudContentExecute(contextResult.value, ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  // 6. Filter
  const filtered = getCloudContentFilter(
    executeResult.value,
    contextResult.value,
    ctx.userEmail
  );

  // 7. Track
  getCloudContentTrack(ctx.actor, inputResult.value.ref_id);

  return { ok: true, value: filtered };
};
