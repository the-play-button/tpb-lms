import type { HandlerContext } from '../../types/HandlerContext.js';

/**
 * Track step: fire-and-forget audit log for sharedByMe.
 */
export const sharedByMeTrack = (ctx: HandlerContext): void => {
  console.log(JSON.stringify({
    operation: 'sharedByMe',
    actor: ctx.userEmail,
    timestamp: new Date().toISOString(),
  }));
};
