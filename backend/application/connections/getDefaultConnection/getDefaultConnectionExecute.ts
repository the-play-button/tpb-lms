import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import type { ConnectionInfo } from '../../../services/types/ConnectionInfo.js';

/**
 * Execute step: fetch the user's default storage connection.
 */
export const getDefaultConnectionExecute = async (ctx: HandlerContext): Promise<Result<string, ConnectionInfo>> => {
  try {
    const connection = await ctx.connectionResolver.getDefaultConnection();
    return succeed(connection);
  } catch (error) {
    return fail((error as Error).message);
  }
};
