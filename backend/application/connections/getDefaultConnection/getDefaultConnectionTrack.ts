import { log } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget audit log for getDefaultConnection.
 */
export const getDefaultConnectionTrack = (): void => {
  log.info('connections:get-default', { file: 'getDefaultConnectionTrack.ts' });
};
