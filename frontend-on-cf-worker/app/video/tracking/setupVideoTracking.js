/**
 * Setup video tracking for a step — dispatches to the resolved VideoProvider
 * adapter (§ hexagonal video port). The provider wires its host's playback events
 * to the shared emit hooks; the backend computes step completion from the pings.
 */

import { trackingState, sendVideoEvent, sendVideoPing, log } from './_shared.js';
import { stopVideoTracking } from './stopVideoTracking.js';
import { resolveProviderById } from '../providers/index.js';

/**
 * @param {number} stepIndex - The step index
 * @param {number} resumePosition - Optional position to resume from (GAP-102)
 */
export const setupVideoTracking = (stepIndex, resumePosition = null) => {
    stopVideoTracking();

    const element = document.getElementById(`video-player-${stepIndex}`);
    if (!element) {
        log.debug('video', 'No video player found for step', { stepIndex });
        return;
    }

    const providerId = element.dataset.provider;
    const provider = resolveProviderById(providerId);
    if (!provider) {
        log.error('video', 'No video provider for element', { stepIndex, providerId });
        return;
    }

    const videoId = element.dataset.youtubeId || element.dataset.loomId || element.dataset.videoId || element.dataset.videoUrl || 'external';
    const videoDuration = parseInt(element.dataset.videoDuration) || 300;
    const courseId = element.dataset.courseId;
    const classId = element.dataset.classId;

    trackingState.lastPingPosition = -10;
    trackingState.isPlaying = false;
    trackingState.videoCompletedHandled = false;

    const hooks = {
        videoDuration,
        resumePosition,
        onEvent: (type, position, duration) => sendVideoEvent(type, videoId, position, duration, courseId, classId),
        onPing: (position, duration) => sendVideoPing(videoId, position, duration, courseId, classId),
    };

    log.info('video', 'Setting up video tracking', { stepIndex, providerId, videoId, videoDuration, resumePosition });
    trackingState.activeTracker = provider.initTracking(element, hooks);
};
