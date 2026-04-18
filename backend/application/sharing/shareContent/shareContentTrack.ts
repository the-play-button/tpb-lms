import { log } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget audit log for shareContent.
 */
export const shareContentTrack = (refId: string, sharedWith: string): void => {
  log.info('sharing:share', { file: 'shareContentTrack.ts', refId, sharedWith });
};
