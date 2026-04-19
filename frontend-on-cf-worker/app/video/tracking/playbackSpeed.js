/**
 * Playback speed control (GAP-101)
 */

import { trackingState, SPEEDS, log } from './_shared.js';

/**
 * Cycle through playback speeds (GAP-101)
 * 0.5x -> 0.75x -> 1x -> 1.25x -> 1.5x -> 1.75x -> 2x -> 0.5x...
 */
export const cyclePlaybackSpeed = () => {
    if (!trackingState.streamPlayer) {
        log.warn('video', 'No active player to change speed');
        return;
    }

    trackingState.currentSpeedIndex = (trackingState.currentSpeedIndex + 1) % SPEEDS.length;
    const newSpeed = SPEEDS[trackingState.currentSpeedIndex];

    try {
        trackingState.streamPlayer.playbackRate = newSpeed;
        log.info('video', 'Playback speed changed', { speed: newSpeed });

        if (typeof showToast === 'function') {
            showToast(`Vitesse: ${newSpeed}x`, 'info');
        }

        const speedDisplay = document.getElementById('speed-display');
        if (speedDisplay) {
            speedDisplay.textContent = `${newSpeed}x`;
        }
    } catch (error) {
        log.error('video', 'Failed to change playback speed', { error: error.message });
    }
};

/**
 * Set specific playback speed
 * @param {number} speed - Playback speed (0.5, 0.75, 1, 1.25, 1.5, 1.75, 2)
 */
export const setPlaybackSpeed = speed => {
    if (!trackingState.streamPlayer) {
        log.warn('video', 'No active player to set speed');
        return;
    }

    const speedIndex = SPEEDS.indexOf(speed);
    if (speedIndex === -1) {
        log.warn('video', 'Invalid playback speed', { speed });
        return;
    }

    trackingState.currentSpeedIndex = speedIndex;
    trackingState.streamPlayer.playbackRate = speed;

    log.info('video', 'Playback speed set', { speed });

    const speedDisplay = document.getElementById('speed-display');
    if (speedDisplay) {
        speedDisplay.textContent = `${speed}x`;
    }
};

/**
 * Get current playback speed
 * @returns {number} Current speed
 */
export const getCurrentSpeed = () => {
    return SPEEDS[trackingState.currentSpeedIndex];
};

/**
 * Get available playback speeds
 * @returns {number[]} Array of available speeds
 */
export const getAvailableSpeeds = () => {
    return [...SPEEDS];
};
