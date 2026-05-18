import { track } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget domain event for listConnections.
 */
export const listConnectionsTrack = (actor: { id: string; type: string }): void => {
  track('lms:connection:listed', actor);
};
