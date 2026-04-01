import type { HandlerContext } from '../../types/HandlerContext.js';

/**
 * Track step: fire-and-forget audit log for sharedWithMe.
 */
export const sharedWithMeTrack = (ctx: HandlerContext): void => {
  console.log(JSON.stringify({
    operation: 'sharedWithMe',
    actor: ctx.userEmail,
    timestamp: new Date().toISOString(),
  }));
};
