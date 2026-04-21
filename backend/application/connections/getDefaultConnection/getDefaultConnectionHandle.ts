import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import type { ConnectionInfo } from '../../../services/types/ConnectionInfo.js';
import { getDefaultConnectionValidateInput } from './getDefaultConnectionValidateInput.js';
import { getDefaultConnectionHydrateContext } from './getDefaultConnectionHydrateContext.js';
import { getDefaultConnectionValidateContext } from './getDefaultConnectionValidateContext.js';
import { getDefaultConnectionCheckPolicies } from './getDefaultConnectionCheckPolicies.js';
import { getDefaultConnectionExecute } from './getDefaultConnectionExecute.js';
import { getDefaultConnectionFilter } from './getDefaultConnectionFilter.js';
import { getDefaultConnectionTrack } from './getDefaultConnectionTrack.js';

/**
 * Handle orchestrator: ValidateInput -> HydrateContext -> ValidateContext -> CheckPolicies -> Execute -> Filter -> Track
 */
export const getDefaultConnectionHandle = async (ctx: HandlerContext): Promise<Result<string, ConnectionInfo>> => {
  // 1. ValidateInput
  const inputResult = getDefaultConnectionValidateInput();
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const hydrateResult = getDefaultConnectionHydrateContext();
  if (!hydrateResult.ok) return fail(hydrateResult.error);

  // 3. ValidateContext
  const validateContextResult = getDefaultConnectionValidateContext();
  if (!validateContextResult.ok) return fail(validateContextResult.error);

  // 4. CheckPolicies
  const policyResult = await getDefaultConnectionCheckPolicies(ctx);
  if (!policyResult.ok) return fail(policyResult.error);

  // 5. Execute
  const executeResult = await getDefaultConnectionExecute(ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  // 6. Filter
  const filtered = getDefaultConnectionFilter(executeResult.value);

  // 7. Track
  getDefaultConnectionTrack(ctx.actor);

  return { ok: true, value: filtered };
};
