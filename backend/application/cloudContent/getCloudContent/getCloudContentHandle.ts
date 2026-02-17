import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { getCloudContentValidateInput } from './getCloudContentValidateInput.js';
import { getCloudContentHydrateContext } from './getCloudContentHydrateContext.js';
import { getCloudContentCheckPolicies } from './getCloudContentCheckPolicies.js';
import { getCloudContentExecute, type GetCloudContentOutput } from './getCloudContentExecute.js';
import { getCloudContentFilter } from './getCloudContentFilter.js';

type GetCloudContentError = 'NOT_FOUND' | 'FORBIDDEN' | string;

/**
 * Handle orchestrator: ValidateInput -> HydrateContext -> CheckPolicies -> Execute -> Filter
 */
export async function getCloudContentHandle(
  request: Request,
  ctx: HandlerContext
): Promise<Result<GetCloudContentError, GetCloudContentOutput>> {
  // 1. ValidateInput
  const inputResult = getCloudContentValidateInput(request);
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const contextResult = await getCloudContentHydrateContext(inputResult.value, ctx);
  if (!contextResult.ok) return fail(contextResult.error);

  // 3. CheckPolicies
  const policyResult = getCloudContentCheckPolicies(contextResult.value);
  if (!policyResult.ok) return fail(policyResult.error);

  // 4. Execute
  const executeResult = await getCloudContentExecute(contextResult.value, ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  // 5. Filter
  const filtered = getCloudContentFilter(
    executeResult.value,
    contextResult.value,
    ctx.userEmail
  );

  return { ok: true, value: filtered };
}
