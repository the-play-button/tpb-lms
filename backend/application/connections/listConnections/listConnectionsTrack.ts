import { log } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget audit log for listConnections.
 */
export const listConnectionsTrack = (): void => {
  log.info('connections:list', { file: 'listConnectionsTrack.ts' });
};
