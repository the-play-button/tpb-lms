import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import type { ConnectionInfo } from '../../../services/types/ConnectionInfo.js';

/**
 * Handle: fetch all storage connections for the authenticated user.
 *
 * Simple use case - uses connectionResolver.getAllConnections() directly.
 */
export async function listConnectionsHandle(
  ctx: HandlerContext
): Promise<Result<string, ConnectionInfo[]>> {
  try {
    const connections = await ctx.connectionResolver.getAllConnections();
    return succeed(connections);
  } catch (error) {
    return fail((error as Error).message);
  }
}
