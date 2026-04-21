import { track } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget domain event for getDefaultConnection.
 */
export const getDefaultConnectionTrack = (actor: { id: string; type: string }): void => {
  track('lms:connection:read-default', actor);
};
