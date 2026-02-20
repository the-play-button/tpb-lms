import type { Result } from '../../domain/core/Result.js';
import { fail } from '../../domain/core/Result.js';
import type { HandlerContext } from '../../types/HandlerContext.js';
import { sharedByMeAssert } from './sharedByMeAssert.js';
import { sharedByMeExecute, type SharedByMeEntry } from './sharedByMeExecute.js';

/**
 * Handle orchestrator: Assert -> Execute
 */
export async function sharedByMeHandle(
  ctx: HandlerContext
): Promise<Result<string, SharedByMeEntry[]>> {
  // 0. Assert
  const assertResult = sharedByMeAssert(ctx.userEmail);
  if (!assertResult.ok) return fail(assertResult.error);

  // 1. Execute
  return sharedByMeExecute(assertResult.value, ctx);
}
