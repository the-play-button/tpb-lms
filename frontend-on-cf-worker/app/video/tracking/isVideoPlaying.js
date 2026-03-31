/**
 * Check if video is currently playing
 */

import { trackingState } from './_shared.js';

export const isVideoPlaying = () => {
    return trackingState.isPlaying;
};
