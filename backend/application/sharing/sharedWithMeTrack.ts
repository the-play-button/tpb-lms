import { track } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget domain event for sharedWithMe.
 */
export const sharedWithMeTrack = (actor: { id: string; type: string }): void => {
  track('lms:share:listed-with-me', actor);
};
