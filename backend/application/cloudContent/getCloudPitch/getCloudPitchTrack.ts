import type { HandlerContext } from '../../../types/HandlerContext.js';

/**
 * Track step: fire-and-forget audit log for getCloudPitch.
 */
export const getCloudPitchTrack = (ctx: HandlerContext, refId: string): void => {
  console.log(JSON.stringify({
    operation: 'getCloudPitch',
    actor: ctx.userEmail,
    refId,
    timestamp: new Date().toISOString(),
  }));
};
