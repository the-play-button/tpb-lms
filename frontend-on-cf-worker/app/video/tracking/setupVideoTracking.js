/**
 * Setup video tracking for a step
 */

import { trackingState, RESUME_THRESHOLD, setupNativeVideoTracking, sendVideoEvent, sendVideoPing, log } from './_shared.js';
import { stopVideoTracking } from './stopVideoTracking.js';

/**
 * Setup video tracking for a step
 * @param {number} stepIndex - The step index
 * @param {number} resumePosition - Optional position to resume from (GAP-102)
 */
export const setupVideoTracking = (stepIndex, resumePosition = null) => {
    stopVideoTracking();

    const iframe = document.getElementById(`video-player-${stepIndex}`);
    if (!iframe) {
        log.debug('video', 'No video player found for step', { stepIndex });
        return;
    }

    const videoId = iframe.dataset.videoId;
    const videoUrl = iframe.dataset.videoUrl;
    const videoDuration = parseInt(iframe.dataset.videoDuration) || 300;
    const courseId = iframe.dataset.courseId;
    const classId = iframe.dataset.classId;

    log.info('video', 'Setting up video tracking', { stepIndex, videoId, videoUrl, videoDuration, resumePosition });

    if (videoUrl && iframe.tagName === 'VIDEO') {
        setupNativeVideoTracking(iframe, videoDuration, courseId, classId, resumePosition);
        return;
    }

    if (typeof Stream === 'undefined') {
        log.error('video', 'Cloudflare Stream SDK not loaded');
        return;
    }

    try {
        trackingState.streamPlayer = Stream(iframe);
        trackingState.lastPingPosition = -10;
        trackingState.isPlaying = false;

        if (resumePosition && resumePosition >= RESUME_THRESHOLD) {
            trackingState.streamPlayer.addEventListener('loadeddata', () => {
                log.debug(`Resuming video at ${resumePosition}s`);
                trackingState.streamPlayer.currentTime = resumePosition;
                trackingState.lastPingPosition = Math.floor(resumePosition / 10) * 10 - 10;
            }, { once: true });
        }

        trackingState.streamPlayer.addEventListener('play', async () => {
            log.debug('Video started playing');
            trackingState.isPlaying = true;
            const currentTime = Math.floor(trackingState.streamPlayer.currentTime || 0);
            await sendVideoEvent('VIDEO_PLAY', videoId, currentTime, videoDuration, courseId, classId);
        });

        trackingState.streamPlayer.addEventListener('pause', async () => {
            log.debug('Video paused');
            trackingState.isPlaying = false;
            const currentTime = Math.floor(trackingState.streamPlayer.currentTime || 0);
            await sendVideoEvent('VIDEO_PAUSE', videoId, currentTime, videoDuration, courseId, classId);
        });

        trackingState.streamPlayer.addEventListener('ended', async () => {
            log.debug('Video ended');
            trackingState.isPlaying = false;

            await sendVideoPing(videoId, videoDuration, videoDuration, courseId, classId);
        });

        trackingState.streamPlayer.addEventListener('timeupdate', async () => {
            if (!trackingState.isPlaying) return;

            const currentTime = Math.floor(trackingState.streamPlayer.currentTime);
            const duration = Math.floor(trackingState.streamPlayer.duration) || videoDuration;

            if (currentTime >= trackingState.lastPingPosition + 10) {
                trackingState.lastPingPosition = Math.floor(currentTime / 10) * 10;
                await sendVideoPing(videoId, currentTime, duration, courseId, classId);
            }
        });

        log.debug('Stream SDK tracking initialized');

    } catch (error) {
        log.error('Failed to initialize Stream SDK:', error);
    }
};
