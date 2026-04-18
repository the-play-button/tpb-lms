import { log } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget audit log for getCloudContent.
 */
export const getCloudContentTrack = (refId: string): void => {
  log.info('cloud-content:get', { file: 'getCloudContentTrack.ts', refId });
};
