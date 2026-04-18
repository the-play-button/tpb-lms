import { log } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget audit log for getCloudPitch.
 */
export const getCloudPitchTrack = (refId: string): void => {
  log.info('cloud-pitch:get', { file: 'getCloudPitchTrack.ts', refId });
};
