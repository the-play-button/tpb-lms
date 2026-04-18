import { log } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget audit log for listPermissions.
 */
export const listPermissionsTrack = (refId: string): void => {
  log.info('sharing:list-permissions', { file: 'listPermissionsTrack.ts', refId });
};
