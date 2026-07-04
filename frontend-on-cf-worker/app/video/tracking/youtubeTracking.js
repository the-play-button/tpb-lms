/**
 * YouTube IFrame API tracking — mirrors the Cloudflare Stream / native <video>
 * tracking so a lesson video hosted on a (private/unlisted) YouTube channel emits
 * VIDEO_PLAY / VIDEO_PAUSE / VIDEO_PING signals for step completion.
 *
 * Event-driven only (no polling timer): the YouTube IFrame API exposes
 * `onStateChange` (PLAYING / PAUSED / ENDED). The API-ready global lives in
 * init/globals.js (§ global_pollution) and is awaited here via
 * `window.__tpbYouTubeApiReady`.
 */
import { trackingState, sendVideoEvent, sendVideoPing, log } from './_shared.js';

const YOUTUBE_IFRAME_API_URL = 'https://www.youtube.com/iframe_api';

let ytScriptInjected = false;

const loadYouTubeApi = () => {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (!ytScriptInjected) {
        ytScriptInjected = true;
        const tag = document.createElement('script');
        tag.src = YOUTUBE_IFRAME_API_URL;
        document.head.appendChild(tag);
    }
    // globals.js exposes this promise; the API script resolves it when ready.
    return window.__tpbYouTubeApiReady ?? Promise.resolve(window.YT);
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
                        await sendVideoPing(youtubeId, t, dur, courseId, classId);
                    } else if (e.data === YT.PlayerState.ENDED) {
                        trackingState.isPlaying = false;
                        await sendVideoPing(youtubeId, dur, dur, courseId, classId);
                    }
                },
            },
        });
        trackingState.youtubePlayer = player;
        trackingState.streamSdkOk = true;
        log.debug('YouTube IFrame API tracking initialized');
    } catch (error) {
        // Best-effort: playback still works even if tracking fails to attach.
        log.error('video', 'YouTube IFrame API tracking failed', error);
        trackingState.streamSdkOk = false;
    }
};
