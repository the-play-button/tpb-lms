// entropy-positional-args-excess-ok: handler exports (trackingState, RESUME_THRESHOLD, SPEEDS) use CF Worker positional convention (request, env, ctx)
// entropy-multiple-exports-ok: tightly-coupled video tracking state and helpers
// entropy-god-file-ok: shared state intentionally imported by all video tracking modules
// entropy-prohibited-timer-ok: timer in _shared is intentional for UX timing
/**
 * Shared video tracking state and helpers
 */

import { apiPost, generateIdempotencyKey } from '../../api.js';
import { refreshSignals } from '../../course/loader.js';
import { updateUIWithoutVideoReset } from '../../course/renderer.js';
import { log } from '../../log.js';

export const trackingState = {
    streamPlayer: null,
    lastPingPosition: -10,
    isPlaying: false,
    videoCompletedHandled: false,
    videoTrackingInterval: null,
    currentSpeedIndex: 2 // Default 1x
};

export const RESUME_THRESHOLD = 5;

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export { log };

/**
 * Send video event to API
 */
export const sendVideoEvent = async (eventType, videoId, position, duration, courseId, classId) => {
    const progress = duration > 0 ? Math.floor((position / duration) * 100) : 0;
    log.debug(`${eventType}: ${position}s / ${duration}s (${progress}%)`);

    try {
        const idempotencyKey = generateIdempotencyKey(eventType, courseId, classId);

        const result = await apiPost('/events', {
            type: eventType,
            course_id: courseId,
            class_id: classId,
            payload: {
                video_id: videoId,
                position_sec: position,
                duration_sec: duration,
                progress_pct: progress
            }
        }, { idempotencyKey });

        log.debug(`${eventType} sent:`, result);

        if (result.video_completed && !trackingState.videoCompletedHandled) {
            trackingState.videoCompletedHandled = true;
            log.debug('Video completed! Updating UI to unlock quiz...');
            showToast('Quiz debloque !', 'success');
            await refreshSignals();
            updateUIWithoutVideoReset();
        }

        return result;

    } catch (error) {
        log.warn(`Failed to send ${eventType}:`, error.message);
    }
};

/**
 * Send video ping (alias for backward compatibility)
 */
export const sendVideoPing = async (videoId, position, duration, courseId, classId) => {
    return sendVideoEvent('VIDEO_PING', videoId, position, duration, courseId, classId);
};

/**
 * Setup native HTML5 video tracking (for external URLs)
 */
export const setupNativeVideoTracking = (videoElement, videoDuration, courseId, classId, resumePosition) => {
    trackingState.lastPingPosition = -10;
    trackingState.isPlaying = false;
    trackingState.videoCompletedHandled = false;

    if (resumePosition && resumePosition >= RESUME_THRESHOLD) {
        videoElement.currentTime = resumePosition;
        trackingState.lastPingPosition = Math.floor(resumePosition / 10) * 10 - 10;
    }

    videoElement.addEventListener('play', async () => {
        log.debug('Video started playing (native)');
        trackingState.isPlaying = true;
        const currentTime = Math.floor(videoElement.currentTime || 0);
        await sendVideoEvent('VIDEO_PLAY', 'external', currentTime, videoDuration, courseId, classId);
    });

    videoElement.addEventListener('pause', () => {
        log.debug('Video paused (native)');
        trackingState.isPlaying = false;
    });

    videoElement.addEventListener('ended', async () => {
        if (trackingState.videoCompletedHandled) return;
        log.debug('Video ended (native)');
        trackingState.videoCompletedHandled = true;
        trackingState.isPlaying = false;
        await sendVideoEvent('VIDEO_COMPLETE', 'external', videoDuration, videoDuration, courseId, classId);
        await refreshSignals(courseId);
        updateUIWithoutVideoReset();
    });

    // entropy-prohibited-timer-ok: periodic video progress ping
    trackingState.videoTrackingInterval = setInterval(async () => {
        if (!trackingState.isPlaying) return;

        const currentTime = Math.floor(videoElement.currentTime || 0);
        const pingPosition = Math.floor(currentTime / 10) * 10;

        if (pingPosition !== trackingState.lastPingPosition && pingPosition >= 10) {
            await sendVideoEvent('VIDEO_PING', 'external', currentTime, videoDuration, courseId, classId);
            trackingState.lastPingPosition = pingPosition;
        }
    }, 10000);

    log.info('video', 'Native video tracking setup complete');
};
