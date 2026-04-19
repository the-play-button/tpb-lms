import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { listPermissionsValidateInput } from './listPermissionsValidateInput.js';
import { listPermissionsHydrateContext } from './listPermissionsHydrateContext.js';
import { listPermissionsValidateContext } from './listPermissionsValidateContext.js';
import { listPermissionsCheckPolicies } from './listPermissionsCheckPolicies.js';
import { listPermissionsExecute, type ListPermissionsOutput } from './listPermissionsExecute.js';
import { listPermissionsFilter } from './listPermissionsFilter.js';
import { listPermissionsTrack } from './listPermissionsTrack.js';

type ListPermissionsError = 'NOT_FOUND' | 'FORBIDDEN' | string;

/**
 * Handle orchestrator: ValidateInput -> HydrateContext -> ValidateContext -> CheckPolicies -> Execute -> Filter -> Track
 */
export const listPermissionsHandle = async (rawRefId: string, ctx: HandlerContext): Promise<Result<ListPermissionsError, ListPermissionsOutput>> => {
  // 1. ValidateInput
  const inputResult = listPermissionsValidateInput(rawRefId);
  if (!inputResult.ok) return fail(inputResult.error);

  // 2. HydrateContext
  const contextResult = await listPermissionsHydrateContext(inputResult.value, ctx);
  if (!contextResult.ok) return fail(contextResult.error);

  // 3. ValidateContext
  const validateContextResult = listPermissionsValidateContext(contextResult.value);
  if (!validateContextResult.ok) return fail(validateContextResult.error);

  // 4. CheckPolicies
  const policyResult = await listPermissionsCheckPolicies(contextResult.value, ctx);
  if (!policyResult.ok) return fail(policyResult.error);

  // 5. Execute
  const executeResult = listPermissionsExecute(contextResult.value);
  if (!executeResult.ok) return fail(executeResult.error);

  // 6. Filter
  const filtered = listPermissionsFilter(
    executeResult.value,
    ctx.userEmail,
    contextResult.value.contentRef.ownerEmail.value
  );

  // 7. Track
  listPermissionsTrack(inputResult.value.ref_id);

  return { ok: true, value: filtered };
};
