/**
 * Pause video (used when tab is hidden)
 */

import { trackingState, log } from './_shared.js';

export const pauseVideo = () => {
    if (trackingState.streamPlayer && trackingState.isPlaying) {
        log.debug('Tab hidden - pausing video');
        trackingState.streamPlayer.pause();
    }
};
