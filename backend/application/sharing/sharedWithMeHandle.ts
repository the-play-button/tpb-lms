import type { Result } from '../../domain/core/Result.js';
import { fail } from '../../domain/core/Result.js';
import type { HandlerContext } from '../../types/HandlerContext.js';
import { sharedWithMeAssert } from './sharedWithMeAssert.js';
import { sharedWithMeExecute, type SharedWithMeEntry } from './sharedWithMeExecute.js';

/**
 * Handle orchestrator: Assert -> Execute
 */
export const sharedWithMeHandle = async (ctx: HandlerContext): Promise<Result<string, SharedWithMeEntry[]>> => {
  // 0. Assert
  const assertResult = sharedWithMeAssert(ctx.userEmail);
  if (!assertResult.ok) return fail(assertResult.error);

  // 1. Execute
  return sharedWithMeExecute(assertResult.value, ctx);
};
