// entropy-multiple-exports-ok: tightly-coupled video tracking state and helpers
// entropy-god-file-ok: shared state intentionally imported by all video tracking modules
/**
 * Shared video tracking state and helpers
 */

import { apiPost, generateIdempotencyKey } from '../../api.js';
import { refreshSignals } from '../../course/loader.js';
import { updateUIWithoutVideoReset } from '../../course/renderer.js';
import { log } from '../../log.js';

// Video tracking state (module-level singletons)
export const trackingState = {
    streamPlayer: null,
    lastPingPosition: -10,
    isPlaying: false,
    videoCompletedHandled: false,
    videoTrackingInterval: null,
    currentSpeedIndex: 2 // Default 1x
};

// Resume position threshold (skip if < 5 seconds)
export const RESUME_THRESHOLD = 5;

// Playback speed control (GAP-101)
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export { log };

/**
 * Send video event to API
 */
export async function sendVideoEvent(eventType, videoId, position, duration, courseId, classId) {
    const progress = duration > 0 ? Math.floor((position / duration) * 100) : 0;
    log.debug(`${eventType}: ${position}s / ${duration}s (${progress}%)`);

    try {
        // Generate idempotency key for deduplication (GAP-711)
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

        // If video completed, update UI to unlock quiz
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
}

/**
 * Send video ping (alias for backward compatibility)
 */
export async function sendVideoPing(videoId, position, duration, courseId, classId) {
    return sendVideoEvent('VIDEO_PING', videoId, position, duration, courseId, classId);
}

/**
 * Setup native HTML5 video tracking (for external URLs)
 */
export function setupNativeVideoTracking(videoElement, videoDuration, courseId, classId, resumePosition) {
    trackingState.lastPingPosition = -10;
    trackingState.isPlaying = false;
    trackingState.videoCompletedHandled = false;

    // Resume position
    if (resumePosition && resumePosition >= RESUME_THRESHOLD) {
        videoElement.currentTime = resumePosition;
        trackingState.lastPingPosition = Math.floor(resumePosition / 10) * 10 - 10;
    }

    // Play event
    videoElement.addEventListener('play', async () => {
        log.debug('Video started playing (native)');
        trackingState.isPlaying = true;
        const currentTime = Math.floor(videoElement.currentTime || 0);
        await sendVideoEvent('VIDEO_PLAY', 'external', currentTime, videoDuration, courseId, classId);
    });

    // Pause event
    videoElement.addEventListener('pause', () => {
        log.debug('Video paused (native)');
        trackingState.isPlaying = false;
    });

    // Ended event
    videoElement.addEventListener('ended', async () => {
        if (trackingState.videoCompletedHandled) return;
        log.debug('Video ended (native)');
        trackingState.videoCompletedHandled = true;
        trackingState.isPlaying = false;
        await sendVideoEvent('VIDEO_COMPLETE', 'external', videoDuration, videoDuration, courseId, classId);
        await refreshSignals(courseId);
        updateUIWithoutVideoReset();
    });

    // Periodic ping while playing
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
}
