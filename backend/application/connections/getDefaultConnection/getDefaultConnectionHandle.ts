import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import type { ConnectionInfo } from '../../../services/types/ConnectionInfo.js';

/**
 * Handle: fetch the user's default storage connection.
 *
 * Simple use case - uses connectionResolver.getDefaultConnection() directly.
 */
export async function getDefaultConnectionHandle(
  ctx: HandlerContext
): Promise<Result<string, ConnectionInfo>> {
  try {
    const connection = await ctx.connectionResolver.getDefaultConnection();
    return succeed(connection);
  } catch (error) {
    return fail((error as Error).message);
  }
}
