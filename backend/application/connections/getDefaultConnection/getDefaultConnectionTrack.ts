import type { HandlerContext } from '../../../types/HandlerContext.js';

/**
 * Track step: fire-and-forget audit log for getDefaultConnection.
 */
export const getDefaultConnectionTrack = (ctx: HandlerContext): void => {
  console.log(JSON.stringify({
    operation: 'getDefaultConnection',
    actor: ctx.userEmail,
    timestamp: new Date().toISOString(),
  }));
};
