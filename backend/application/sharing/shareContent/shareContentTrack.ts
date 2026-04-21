import { track } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget domain event for shareContent.
 */
export const shareContentTrack = (actor: { id: string; type: string }, refId: string, sharedWith: string): void => {
  track('lms:content:shared', actor, { refId, sharedWith });
};
