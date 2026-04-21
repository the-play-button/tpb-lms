import { track } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget domain event for getCloudContent.
 */
export const getCloudContentTrack = (actor: { id: string; type: string }, refId: string): void => {
  track('lms:cloud-content:read', actor, { refId });
};
