import { log } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget audit log for sharedWithMe.
 */
export const sharedWithMeTrack = (): void => {
  log.info('sharing:shared-with-me', { file: 'sharedWithMeTrack.ts' });
};
