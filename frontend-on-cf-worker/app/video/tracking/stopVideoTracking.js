/**
 * Stop video tracking — destroys the active VideoProvider tracker + resets state.
 */

import { trackingState, log } from './_shared.js';

export const stopVideoTracking = () => {
    if (trackingState.activeTracker) {
        log.debug('Stopping video tracking');
        try { trackingState.activeTracker.destroy?.(); } catch { /* element already gone */ }
        trackingState.activeTracker = null;
    }
    // Legacy holders populated by adapters (CF Stream) — drop refs.
    trackingState.streamPlayer = null;
    trackingState.youtubePlayer = null;
    trackingState.lastPingPosition = -10;
    trackingState.isPlaying = false;
    trackingState.videoCompletedHandled = false;
};
