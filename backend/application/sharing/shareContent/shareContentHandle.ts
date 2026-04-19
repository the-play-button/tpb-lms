// entropy-positional-args-excess-ok: shareContentHandle follows DDD pipeline convention (request, ctx, param) positional args
import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { shareContentValidateInput } from './shareContentValidateInput.js';
import { shareContentHydrateContext } from './shareContentHydrateContext.js';
import { shareContentValidateContext } from './shareContentValidateContext.js';
import { shareContentCheckPolicies } from './shareContentCheckPolicies.js';
import { shareContentExecute, type ShareContentOutput } from './shareContentExecute.js';
import { shareContentFilter } from './shareContentFilter.js';
import { shareContentTrack } from './shareContentTrack.js';

type ShareContentError = 'NOT_FOUND' | 'FORBIDDEN' | string;

/**
 * Handle orchestrator: ValidateInput -> HydrateContext -> ValidateContext -> CheckPolicies -> Execute -> Filter -> Track
 */
export const shareContentHandle = async (request: Request, ctx: HandlerContext, refId: string): Promise<Result<ShareContentError, Partial<ShareContentOutput>>> => {
  // 1. ValidateInput
  const inputResult = await shareContentValidateInput(request, refId);
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const contextResult = await shareContentHydrateContext(inputResult.value, ctx);
  if (!contextResult.ok) return fail(contextResult.error);

  // 3. ValidateContext
  const validateContextResult = shareContentValidateContext(contextResult.value);
  if (!validateContextResult.ok) return fail(validateContextResult.error);

  // 4. CheckPolicies
  const policyResult = await shareContentCheckPolicies(contextResult.value, ctx.userEmail, ctx);
  if (!policyResult.ok) return fail(policyResult.error);

  // 5. Execute
  const executeResult = await shareContentExecute(inputResult.value, contextResult.value, ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  // 6. Filter
  const filtered = shareContentFilter(
    executeResult.value,
    ctx.userEmail,
    contextResult.value.contentRef.ownerEmail.value
  );

  // 7. Track
  shareContentTrack(inputResult.value.ref_id, inputResult.value.email);

  return { ok: true, value: filtered };
};
