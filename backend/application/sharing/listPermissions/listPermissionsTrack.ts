import { track } from '@the-play-button/tpb-sdk-js';

/**
 * Track step: fire-and-forget domain event for listPermissions.
 */
export const listPermissionsTrack = (actor: { id: string; type: string }, refId: string): void => {
  track('lms:permission:listed', actor, { refId });
};
