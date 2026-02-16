/**
 * Stop video tracking
 */

import { trackingState, log } from './_shared.js';

export function stopVideoTracking() {
    if (trackingState.streamPlayer) {
        log.debug('Stopping video tracking');
        trackingState.streamPlayer = null;
        trackingState.lastPingPosition = -10;
        trackingState.isPlaying = false;
        trackingState.videoCompletedHandled = false;
    }
    if (trackingState.videoTrackingInterval) {
        clearInterval(trackingState.videoTrackingInterval);
        trackingState.videoTrackingInterval = null;
    }
}
