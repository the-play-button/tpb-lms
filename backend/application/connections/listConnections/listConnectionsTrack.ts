import type { HandlerContext } from '../../../types/HandlerContext.js';

/**
 * Track step: fire-and-forget audit log for listConnections.
 */
export const listConnectionsTrack = (ctx: HandlerContext): void => {
  console.log(JSON.stringify({
    operation: 'listConnections',
    actor: ctx.userEmail,
    timestamp: new Date().toISOString(),
  }));
};
