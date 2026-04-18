import { log } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget audit log for sharedByMe.
 */
export const sharedByMeTrack = (): void => {
  log.info('sharing:shared-by-me', { file: 'sharedByMeTrack.ts' });
};
