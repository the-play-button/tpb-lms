import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { shareContentAssert } from './shareContentAssert.js';
import { shareContentValidateInput } from './shareContentValidateInput.js';
import { shareContentHydrateContext } from './shareContentHydrateContext.js';
import { shareContentCheckPolicies } from './shareContentCheckPolicies.js';
import { shareContentExecute, type ShareContentOutput } from './shareContentExecute.js';
import { shareContentFilter } from './shareContentFilter.js';

type ShareContentError = 'NOT_FOUND' | 'FORBIDDEN' | string;

/**
 * Handle orchestrator: Assert -> ValidateInput -> HydrateContext -> CheckPolicies -> Execute -> Filter
 */
export const shareContentHandle = async (request: Request, ctx: HandlerContext, refId: string): Promise<Result<ShareContentError, Partial<ShareContentOutput>>> => {
  // 0. Assert
  const assertResult = shareContentAssert(refId);
  if (!assertResult.ok) return fail(assertResult.error);

  // 1. ValidateInput
  const inputResult = await shareContentValidateInput(request);
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const contextResult = await shareContentHydrateContext(inputResult.value, ctx, refId);
  if (!contextResult.ok) return fail(contextResult.error);

  // 3. CheckPolicies
  const policyResult = shareContentCheckPolicies(contextResult.value, ctx.userEmail);
  if (!policyResult.ok) return fail(policyResult.error);

  // 4. Execute
  const executeResult = await shareContentExecute(inputResult.value, contextResult.value, ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  // 5. Filter
  const filtered = shareContentFilter(
    executeResult.value,
    ctx.userEmail,
    contextResult.value.contentRef.ownerEmail.value
  );

  return { ok: true, value: filtered };
};
