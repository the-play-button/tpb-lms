import { track } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget domain event for listSharedWithMe.
 */
export const listSharedWithMeTrack = (actor: { id: string; type: string }): void => {
  track('lms:share:listed-with-me', actor);
};
