import { log } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget audit log for revokeShare.
 */
export const revokeShareTrack = (shareId: string): void => {
  log.info('sharing:revoke', { file: 'revokeShareTrack.ts', shareId });
};
