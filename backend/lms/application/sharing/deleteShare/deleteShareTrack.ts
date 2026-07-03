import { track } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget domain event for deleteShare.
 */
export const deleteShareTrack = (actor: { id: string; type: string }, shareId: string): void => {
  track('lms:share:revoked', actor, { shareId });
};
