import type { HandlerContext } from '../../../types/HandlerContext.js';

/**
 * Track step: fire-and-forget audit log for listPermissions.
 */
export const listPermissionsTrack = (ctx: HandlerContext, refId: string): void => {
  console.log(JSON.stringify({
    operation: 'listPermissions',
    actor: ctx.userEmail,
    refId,
    timestamp: new Date().toISOString(),
  }));
};
