import type { HandlerContext } from '../../../types/HandlerContext.js';

/**
 * Track step: fire-and-forget audit log for getCloudContent.
 */
export const getCloudContentTrack = (ctx: HandlerContext, refId: string): void => {
  console.log(JSON.stringify({
    operation: 'getCloudContent',
    actor: ctx.userEmail,
    refId,
    timestamp: new Date().toISOString(),
  }));
};
