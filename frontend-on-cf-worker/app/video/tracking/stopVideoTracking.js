/**
 * Stop video tracking
 */

import { trackingState, log } from './_shared.js';

export const stopVideoTracking = () => {
    if (trackingState.streamPlayer) {
        log.debug('Stopping video tracking');
        trackingState.streamPlayer = null;
        trackingState.lastPingPosition = -10;
        trackingState.isPlaying = false;
        trackingState.videoCompletedHandled = false;
    }
    // Signal-based pings are bound to the <video> element via 'timeupdate' —
    // they auto-stop when the video is removed from the DOM. No interval to clear.
};
