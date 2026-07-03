import { track } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget domain event for listSharedByMe.
 */
export const listSharedByMeTrack = (actor: { id: string; type: string }): void => {
  track('lms:share:listed-by-me', actor);
};
