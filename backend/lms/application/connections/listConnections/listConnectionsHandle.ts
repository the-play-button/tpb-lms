import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import type { ConnectionInfo } from '../../../services/types/ConnectionInfo.js';
import { listConnectionsValidateInput } from './listConnectionsValidateInput.js';
import { listConnectionsHydrateContext } from './listConnectionsHydrateContext.js';
import { listConnectionsValidateContext } from './listConnectionsValidateContext.js';
import { listConnectionsCheckPolicies } from './listConnectionsCheckPolicies.js';
import { listConnectionsExecute } from './listConnectionsExecute.js';
import { listConnectionsFilter } from './listConnectionsFilter.js';
import { listConnectionsTrack } from './listConnectionsTrack.js';

/**
 * Handle orchestrator: ValidateInput -> HydrateContext -> ValidateContext -> CheckPolicies -> Execute -> Filter -> Track
 */
export const listConnectionsHandle = async (ctx: HandlerContext): Promise<Result<string, ConnectionInfo[]>> => {
  // 1. ValidateInput
  const inputResult = listConnectionsValidateInput();
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const hydrateResult = listConnectionsHydrateContext();
  if (!hydrateResult.ok) return fail(hydrateResult.error);

  // 3. ValidateContext
  const validateContextResult = listConnectionsValidateContext();
  if (!validateContextResult.ok) return fail(validateContextResult.error);

  // 4. CheckPolicies
  const policyResult = await listConnectionsCheckPolicies(ctx);
  if (!policyResult.ok) return fail(policyResult.error);

  // 5. Execute
  const executeResult = await listConnectionsExecute(ctx);
  if (!executeResult.ok) return fail(executeResult.error);

  // 6. Filter
  const filtered = listConnectionsFilter(executeResult.value);

  // 7. Track
  listConnectionsTrack(ctx.actor);

  return { ok: true, value: filtered };
};
