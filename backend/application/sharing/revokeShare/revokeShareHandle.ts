import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { revokeShareValidateInput } from './revokeShareValidateInput.js';
import { revokeShareHydrateContext } from './revokeShareHydrateContext.js';
import { revokeShareCheckPolicies } from './revokeShareCheckPolicies.js';
import { revokeShareExecute, type RevokeShareOutput } from './revokeShareExecute.js';

type RevokeShareError = 'NOT_FOUND' | 'FORBIDDEN' | string;

/**
 * Handle orchestrator: ValidateInput -> HydrateContext -> CheckPolicies -> Execute
 */
export async function revokeShareHandle(
  request: Request,
  ctx: HandlerContext
): Promise<Result<RevokeShareError, RevokeShareOutput>> {
  // 1. ValidateInput
  const inputResult = await revokeShareValidateInput(request);
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const contextResult = await revokeShareHydrateContext(inputResult.value, ctx);
  if (!contextResult.ok) return fail(contextResult.error);

  // 3. CheckPolicies
  const policyResult = revokeShareCheckPolicies(contextResult.value);
  if (!policyResult.ok) return fail(policyResult.error);

  // 4. Execute
  const executeResult = await revokeShareExecute(contextResult.value, ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  return { ok: true, value: executeResult.value };
}
