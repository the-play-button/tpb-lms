import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import type { ConnectionInfo } from '../../../services/types/ConnectionInfo.js';
import { getDefaultConnectionAssert } from './getDefaultConnectionAssert.js';
import { getDefaultConnectionExecute } from './getDefaultConnectionExecute.js';

/**
 * Handle orchestrator: Assert -> Execute
 */
export async function getDefaultConnectionHandle(
  ctx: HandlerContext
): Promise<Result<string, ConnectionInfo>> {
  // 0. Assert
  const assertResult = getDefaultConnectionAssert();
  if (!assertResult.ok) return fail(assertResult.error);

  // 1. Execute
  return getDefaultConnectionExecute(ctx);
}
