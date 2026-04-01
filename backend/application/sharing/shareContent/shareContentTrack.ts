import type { HandlerContext } from '../../../types/HandlerContext.js';

/**
 * Track step: fire-and-forget audit log for shareContent.
 */
export const shareContentTrack = (ctx: HandlerContext, refId: string, sharedWith: string): void => {
  console.log(JSON.stringify({
    operation: 'shareContent',
    actor: ctx.userEmail,
    refId,
    sharedWith,
    timestamp: new Date().toISOString(),
  }));
};
