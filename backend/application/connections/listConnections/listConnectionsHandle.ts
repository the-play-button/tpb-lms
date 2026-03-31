import type { Result } from '../../../domain/core/Result.js';
import { fail } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import type { ConnectionInfo } from '../../../services/types/ConnectionInfo.js';
import { listConnectionsAssert } from './listConnectionsAssert.js';
import { listConnectionsExecute } from './listConnectionsExecute.js';

/**
 * Handle orchestrator: Assert -> Execute
 */
export const listConnectionsHandle = async (ctx: HandlerContext): Promise<Result<string, ConnectionInfo[]>> => {
  // 0. Assert
  const assertResult = listConnectionsAssert();
  if (!assertResult.ok) return fail(assertResult.error);

  // 1. Execute
  return listConnectionsExecute(ctx);
};
