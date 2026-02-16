/**
 * Check if video is currently playing
 */

import { trackingState } from './_shared.js';

export function isVideoPlaying() {
    return trackingState.isPlaying;
}
