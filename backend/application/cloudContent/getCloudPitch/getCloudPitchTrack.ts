import { track } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget domain event for getCloudPitch.
 */
export const getCloudPitchTrack = (actor: { id: string; type: string }, refId: string): void => {
  track('lms:cloud-pitch:read', actor, { refId });
};
