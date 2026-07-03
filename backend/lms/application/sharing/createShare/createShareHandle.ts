import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { createShareValidateInput } from './createShareValidateInput.js';
import { createShareHydrateContext } from './createShareHydrateContext.js';
import { createShareValidateContext } from './createShareValidateContext.js';
import { createShareCheckPolicies } from './createShareCheckPolicies.js';
import { createShareExecute, type ShareContentOutput } from './createShareExecute.js';
import { createShareFilter } from './createShareFilter.js';
import { createShareTrack } from './createShareTrack.js';

type ShareContentError = 'NOT_FOUND' | 'FORBIDDEN' | string;

/**
 * Handle orchestrator: ValidateInput -> HydrateContext -> ValidateContext -> CheckPolicies -> Execute -> Filter -> Track
 */
export const createShareHandle = async (request: Request, ctx: HandlerContext, refId: string): Promise<Result<ShareContentError, Partial<ShareContentOutput>>> => {
  // 1. ValidateInput
  const inputResult = await createShareValidateInput(request, refId);
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const contextResult = await createShareHydrateContext(inputResult.value, ctx);
  if (!contextResult.ok) return fail(contextResult.error);

  // 3. ValidateContext
  const validateContextResult = createShareValidateContext(contextResult.value);
  if (!validateContextResult.ok) return fail(validateContextResult.error);

  // 4. CheckPolicies
  const policyResult = await createShareCheckPolicies(contextResult.value, ctx.userEmail, ctx);
  if (!policyResult.ok) return fail(policyResult.error);

  // 5. Execute
  const executeResult = await createShareExecute(inputResult.value, contextResult.value, ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  // 6. Filter
  const filtered = createShareFilter(
    executeResult.value,
    ctx.userEmail,
    contextResult.value.contentRef.ownerEmail.value
  );

  // 7. Track
  createShareTrack(ctx.actor, inputResult.value.ref_id, inputResult.value.email);

  return { ok: true, value: filtered };
};
