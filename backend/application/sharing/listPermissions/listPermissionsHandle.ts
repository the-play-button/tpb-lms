import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { listPermissionsAssert } from './listPermissionsAssert.js';
import { listPermissionsExecute, type ListPermissionsOutput } from './listPermissionsExecute.js';

type ListPermissionsError = 'NOT_FOUND' | 'FORBIDDEN' | string;

/**
 * Handle orchestrator: Assert -> Execute
 */
export async function listPermissionsHandle(
  rawRefId: string,
  ctx: HandlerContext
): Promise<Result<ListPermissionsError, ListPermissionsOutput>> {
  // 0. Assert
  const assertResult = listPermissionsAssert(rawRefId);
  if (!assertResult.ok) return fail(assertResult.error);

  // 1. Execute
  return listPermissionsExecute(assertResult.value, ctx);
}
