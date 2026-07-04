/**
 * YouTube IFrame API tracking — mirrors the Cloudflare Stream / native <video>
 * tracking so a lesson video hosted on a (private/unlisted) YouTube channel emits
 * the same VIDEO_PLAY / VIDEO_PAUSE / VIDEO_PING signals used for step completion.
 *
 * The <iframe> is rendered by videoSection.js with `?enablejsapi=1` +
 * data-youtube-id, so the YouTube IFrame API can attach to it.
 */
import { trackingState, sendVideoEvent, sendVideoPing, log } from './_shared.js';

let ytApiPromise = null;

const loadYouTubeApi = () => {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise((resolve) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (typeof prev === 'function') prev();
            resolve(window.YT);
        };
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
    });
    return ytApiPromise;
};

export const setupYoutubeTracking = async (iframe, videoDuration, courseId, classId) => {
    const youtubeId = iframe.dataset.youtubeId;
    trackingState.lastPingPosition = -10;
    trackingState.isPlaying = false;
    try {
        const YT = await loadYouTubeApi();
        const player = new YT.Player(iframe, {
            events: {
                onStateChange: async (e) => {
                    const t = Math.floor(player.getCurrentTime?.() || 0);
                    const dur = Math.floor(player.getDuration?.() || videoDuration);
                    if (e.data === YT.PlayerState.PLAYING) {
                        trackingState.isPlaying = true;
                        await sendVideoEvent('VIDEO_PLAY', youtubeId, t, dur, courseId, classId);
                    } else if (e.data === YT.PlayerState.PAUSED) {
                        trackingState.isPlaying = false;
                        await sendVideoEvent('VIDEO_PAUSE', youtubeId, t, dur, courseId, classId);
                    } else if (e.data === YT.PlayerState.ENDED) {
                        trackingState.isPlaying = false;
                        await sendVideoPing(youtubeId, dur, dur, courseId, classId);
                    }
                },
            },
        });
        trackingState.youtubePlayer = player;
        // Periodic ping while playing (one ping per crossed 10s boundary).
        trackingState.youtubeInterval = setInterval(async () => {
            if (!trackingState.isPlaying || typeof player.getCurrentTime !== 'function') return;
            const t = Math.floor(player.getCurrentTime());
            const dur = Math.floor(player.getDuration?.() || videoDuration);
            if (t >= trackingState.lastPingPosition + 10) {
                trackingState.lastPingPosition = Math.floor(t / 10) * 10;
                await sendVideoPing(youtubeId, t, dur, courseId, classId);
            }
        }, 5000);
        trackingState.streamSdkOk = true;
        log.debug('YouTube IFrame API tracking initialized');
    } catch (error) {
        // Best-effort: playback still works even if tracking fails to attach.
        log.error('video', 'YouTube IFrame API tracking failed', error);
        trackingState.streamSdkOk = false;
    }
};
