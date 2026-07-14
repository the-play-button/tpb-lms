/**
 * Shared video tracking state and helpers
 */

import { apiPost, generateIdempotencyKey } from '../../api.js';
import { refreshSignals } from '../../course/loader.js';
import { updateUIWithoutVideoReset } from '../../course/renderer.js';
import { log } from '../../log.js';

export const trackingState = {
    streamPlayer: null,       // CF Stream player (populated by cloudflareProvider — pause/speed)
    youtubePlayer: null,      // legacy holder (kept for back-compat clears)
    activeTracker: null,      // { destroy() } returned by the active VideoProvider adapter
    lastPingPosition: -10,
    isPlaying: false,
    videoCompletedHandled: false,
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
        return { sent: false, eventType, error: error.message }; // explicit telemetry failure marker
    }
};

/**
 * Send VIDEO_PING event — thin convenience wrapper.
 * Lets the calling code stay declarative (« send a ping ») instead of
 * spelling the event-type string inline at each call site.
 */
export const sendVideoPing = async (videoId, position, duration, courseId, classId) => {
    return sendVideoEvent('VIDEO_PING', videoId, position, duration, courseId, classId);
};
