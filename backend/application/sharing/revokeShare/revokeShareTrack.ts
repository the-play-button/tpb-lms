import type { HandlerContext } from '../../../types/HandlerContext.js';

/**
 * Track step: fire-and-forget audit log for revokeShare.
 */
export const revokeShareTrack = (ctx: HandlerContext, shareId: string): void => {
  console.log(JSON.stringify({
    operation: 'revokeShare',
    actor: ctx.userEmail,
    shareId,
    timestamp: new Date().toISOString(),
  }));
};
